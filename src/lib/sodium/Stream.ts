import { Vertex, StreamVertex, ListenerVertex, CellVertex } from "./Vertex";
import { Transaction } from "./Transaction";
import { Cell } from "./Cell";
import { Tuple2 } from "./Tuple2";
import { Lazy } from "./Lazy";
import { CellLoop } from "./CellLoop";

class SnapshotVertex<A, B, C> extends StreamVertex<C> {
    constructor(
        sa: StreamVertex<A>,
        cb: CellVertex<B>,
        f: (a: A, b: B) => C,
    ) {
        super();

        this.f = f;
        this.sa = sa;
        this.cb = cb;

        sa.addDependent(this);
    }

    private readonly sa: StreamVertex<A>;
    private readonly cb: CellVertex<B>;
    private readonly f: (a: A, b: B) => C;

    buildNewValue(): C | undefined {
        const f = this.f;
        const na = this.sa.newValue;
        const b = this.cb.oldValue;
        const nb = na !== undefined ? f(na, b) : undefined;
        return nb;
    }
}

class Snapshot4Vertex<A, B, C, D, E> extends StreamVertex<E> {
    constructor(
        sa: StreamVertex<A>,
        cb: CellVertex<B>,
        cc: CellVertex<C>,
        cd: CellVertex<D>,
        f: (a: A, b: B, c: C, d: D) => E,
    ) {
        super();

        this.f = f;
        this.sa = sa;
        this.cb = cb;
        this.cc = cc;
        this.cd = cd;

        sa.addDependent(this);
    }

    private readonly sa: StreamVertex<A>;
    private readonly cb: CellVertex<B>;
    private readonly cc: CellVertex<C>;
    private readonly cd: CellVertex<D>;

    private readonly f: (a: A, b: B, c: C, d: D) => E;

    buildNewValue(): E | undefined {
        const na = this.sa.newValue;

        if (na === undefined) return undefined;

        const f = this.f;
        const b = this.cb.oldValue;
        const c = this.cc.oldValue;
        const d = this.cd.oldValue;

        const e = f(na, b, c, d);

        return e;
    }
}

export class HoldVertex<A> extends CellVertex<A> {
    constructor(
        initValue: A,
        steps: StreamVertex<A>,
    ) {
        super(initValue);

        this.steps = steps;

        steps.addDependent(this);
    }

    private readonly steps: StreamVertex<A>;

    buildNewValue(): A | undefined {
        const na = this.steps.newValue;
        return na;
    }
}

class FilterVertex<A> extends StreamVertex<A> {
    constructor(
        s: StreamVertex<A>,
        f: (a: A) => boolean,
    ) {
        super();

        this.s = s;
        this.f = f;

        s.addDependent(this);
    }

    private readonly s: StreamVertex<A>;
    private readonly f: (a: A) => boolean;

    buildNewValue(): A | undefined {
        const na = this.s.newValue;
        const f = this.f;

        if (na === undefined) return undefined;

        if (f(na)) {
            return na;
        } else {
            return undefined;
        }
    }
}

class StreamMapVertex<A, B> extends StreamVertex<B> {
    constructor(
        source: StreamVertex<A>,
        f: (a: A) => B,
    ) {
        super();

        this.source = source;
        this.f = f;

        source.addDependent(this);
    }

    private readonly source: StreamVertex<A>;
    private readonly f: (a: A) => B;

    buildNewValue(): B | undefined {
        const f = this.f;
        const na = this.source.newValue;
        const nb = na !== undefined ? f(na) : undefined;
        return nb;
    }
}

class StreamMergeVertex<A> extends StreamVertex<A> {
    constructor(
        s0: StreamVertex<A>,
        s1: StreamVertex<A>,
        f: (a0: A, a1: A) => A,
    ) {
        super();

        this.s0 = s0;
        this.s1 = s1;
        this.f = f;

        s0.addDependent(this);
        s1.addDependent(this);
    }

    private readonly s0: StreamVertex<A>;
    private readonly s1: StreamVertex<A>;

    private readonly f: (a0: A, a1: A) => A;

    buildNewValue(): A | undefined {
        const f = this.f;
        const n0 = this.s0.newValue;
        const n1 = this.s1.newValue;

        if (n0 !== undefined && n1 !== undefined) {
            return f(n0, n1);
        } else if (n0 !== undefined) {
            return n0;
        } else if (n1 !== undefined) {
            return n1;
        } else {
            return undefined;
        }
    }
}

class StreamFirstOfVertex<A> extends StreamVertex<A> {
    constructor(
        streams: Stream<A>[],
    ) {
        super();

        this.streams = streams;

        streams.forEach((s) => s.vertex.addDependent(this));
    }

    private readonly streams: Stream<A>[];

    buildNewValue(): A | undefined {
        const s = this.streams.find((s) => s.vertex.newValue !== undefined);
        const na = s?.vertex.newValue;

        if (na !== undefined) {
            return na;
        } else {
            return undefined;
        }
    }
}

class StreamOnceVertex<A> extends StreamVertex<A> {
    constructor(
        s: StreamVertex<A>,
    ) {
        super();

        this.s = s;

        s.addDependent(this);
    }

    private readonly s: StreamVertex<A>;

    private hasFired = false;

    buildNewValue(): A | undefined {
        const na = this.s.newValue;

        if (na === undefined || this.hasFired) return undefined;

        this.hasFired = true;
        this.s.dependents.delete(this);

        return na;
    }
}

export class Stream<A> {
    constructor(vertex?: StreamVertex<A>) {
        this.vertex = vertex || new StreamVertex();
    }

    vertex: StreamVertex<A>;

    rename(name: string): Stream<A> {
        this.vertex.name = name;
        return this;
    }

    /**
     * Transform the stream's event values according to the supplied function, so the returned
     * Stream's event values reflect the value of the function applied to the input
     * Stream's event values.
     * @param f Function to apply to convert the values. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    map<B>(f: (a: A) => B): Stream<B> {
        return new Stream(new StreamMapVertex(this.vertex, f));
    }

    /**
     * Transform the stream's event values into the specified constant value.
     * @param b Constant value.
     */
    mapTo<B>(b: B): Stream<B> {
        return this.map((_) => b);
    }

    /**
     * Variant of {@link Stream#merge(Stream, Lambda2)} that merges two streams and will drop an event
     * in the simultaneous case.
     * <p>
     * In the case where two events are simultaneous (i.e. both
     * within the same transaction), the event from <em>this</em> will take precedence, and
     * the event from <em>s</em> will be dropped.
     * If you want to specify your own combining function, use {@link Stream#merge(Stream, Lambda2)}.
     * s1.orElse(s2) is equivalent to s1.merge(s2, (l, r) -&gt; l).
     * <p>
     * The name orElse() is used instead of merge() to make it really clear that care should
     * be taken, because events can be dropped.
     */
    orElse(s: Stream<A>): Stream<A> {
        return this.merge(s, (l, _r) => l);
    }

    /**
     * Merge two streams of the same type into one, so that events on either input appear
     * on the returned stream.
     * <p>
     * If the events are simultaneous (that is, one event from this and one from <em>s</em>
     * occurring in the same transaction), combine them into one using the specified combining function
     * so that the returned stream is guaranteed only ever to have one event per transaction.
     * The event from <em>this</em> will appear at the left input of the combining function, and
     * the event from <em>s</em> will appear at the right.
     * @param f Function to combine the values. It may construct FRP logic or use
     *    {@link Cell#sample()}. Apart from this the function must be <em>referentially transparent</em>.
     */
    merge(s: Stream<A>, f: (left: A, right: A) => A): Stream<A> {
        return new Stream(new StreamMergeVertex(this.vertex, s.vertex, f));
    }

    /**
     * Return a stream that only outputs events for which the predicate returns true.
     */
    filter(f: (a: A) => boolean): Stream<A> {
        return new Stream(new FilterVertex(this.vertex, f));
    }

    /**
     * Return a stream that only outputs events that have present
     * values, discarding null values.
     */
    filterNotNull(): Stream<A> {
        return this.filter((a) => a !== null);
    }

    /**
     * Return a stream that only outputs events from the input stream
     * when the specified cell's value is true.
     */
    gate(c : Cell<boolean>) : Stream<A> {
        return this.snapshot(c, (a : A, pred : boolean) => {
            return pred ? a : null;
        }).filterNotNull();
    }

	/**
	 * Variant of {@link snapshot(Cell, Lambda2)} that captures the cell's value
	 * at the time of the event firing, ignoring the stream's value.
	 */
    snapshot1<B>(c: Cell<B>): Stream<B> {
        return new Stream(new SnapshotVertex(this.vertex, c.vertex, (_, b) => b));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cell at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, {@link Stream#snapshot(Cell, Lambda2)}
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot<B, C>(b: Cell<B>, f: (a: A, b: B) => C): Stream<C> {
        return new Stream(new SnapshotVertex(this.vertex, b.vertex, f));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot3<B, C, D>(b: Cell<B>, c: Cell<C>, f_: (a: A, b: B, c: C) => D): Stream<D> {
        throw new Error();
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot4<B, C, D, E>(b: Cell<B>, c: Cell<C>, d: Cell<D>,
        f_: (a: A, b: B, c: C, d: D) => E): Stream<E> {
        return new Stream(new Snapshot4Vertex<A, B, C, D, E>(
            this.vertex, b.vertex, c.vertex, d.vertex, f_));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot5<B, C, D, E, F>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>,
        f_: (a: A, b: B, c: C, d: D, e: E) => F): Stream<F> {
        throw new Error();
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot6<B, C, D, E, F, G>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>, f: Cell<F>,
        f_: (a: A, b: B, c: C, d: D, e: E, f: F) => G): Stream<G> {
        throw new Error();
    }

	/**
	 * Create a {@link Cell} with the specified initial value, that is updated
     * by this stream's event values.
     * <p>
     * There is an implicit delay: State updates caused by event firings don't become
     * visible as the cell's current value as viewed by {@link Stream#snapshot(Cell, Lambda2)}
     * until the following transaction. To put this another way,
     * {@link Stream#snapshot(Cell, Lambda2)} always sees the value of a cell as it was before
     * any state changes from the current transaction.
     */
    hold(initValue: A): Cell<A> {
        return new Cell(undefined, undefined, new HoldVertex(initValue, this.vertex));
    }

	/**
	 * A variant of {@link hold(Object)} with an initial value captured by {@link Cell#sampleLazy()}.
	 */
    holdLazy(initValue: Lazy<A>): Cell<A> {
        throw new Error();
    }

    /**
     * Transform an event with a generalized state loop (a Mealy machine). The function
     * is passed the input and the old state and returns the new state and output value.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    collect<B, S>(initState: S, f: (a: A, s: S) => Tuple2<B, S>): Stream<B> {
        throw new Error();
    }

    /**
     * A variant of {@link collect(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    collectLazy<B, S>(initState: Lazy<S>, f: (a: A, s: S) => Tuple2<B, S>): Stream<B> {
        throw new Error();
    }

    /**
     * Accumulate on input event, outputting the new state each time.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    accum<S>(initState: S, f: (a: A, s: S) => S): Cell<S> {
        const loop = new CellLoop<S>();
        const out = this.snapshot(loop, f).hold(initState);
        loop.loop(out);
        return out;
    }

    /**
     * A variant of {@link accum(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    accumLazy<S>(initState: Lazy<S>, f: (a: A, s: S) => S): Cell<S> {
        throw new Error();
    }

    /**
     * Return a stream that outputs only one value: the next event of the
     * input stream, starting from the transaction in which once() was invoked.
     */
    once(): Stream<A> {
        return new Stream(new StreamOnceVertex(this.vertex));
    }

    listen(h: (a: A) => void): () => void {
        new ListenerVertex(this.vertex, h);
        return () => { };
    }

    static firstOf<A>(streams: Stream<A>[]): Stream<A> {
        return new Stream(new StreamFirstOfVertex<A>(streams));
    }
}

export class StreamLoopVertex<A> extends StreamVertex<A> {
    isLooped = false;

    private source?: StreamVertex<A>;

    constructor() {
        super();
    }

    buildNewValue(): A | undefined {
        // TODO: Better exception message?
        return this.source!.newValue;
    }

    loop(source: StreamVertex<A>): void {
        if (this.isLooped)
            throw new Error("StreamLoop looped more than once");

        this.source = source;

        source.addDependent(this);
    }
}

/**
 * A forward reference for a {@link Stream} equivalent to the Stream that is referenced.
 */
export class StreamLoop<A> extends Stream<A> {
    isLooped = false;

    private source?: StreamVertex<A>;

    constructor() {
        super(new StreamLoopVertex());
    }

    loop(sa_out: Stream<A>): void {
        (this.vertex as StreamLoopVertex<A>).loop(sa_out.vertex);
    }
}
