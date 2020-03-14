import {
    Lambda1, Lambda1_deps, Lambda1_toFunction,
    Lambda2, Lambda2_deps, Lambda2_toFunction,
    Lambda3, Lambda3_deps, Lambda3_toFunction,
    Lambda4, Lambda4_deps, Lambda4_toFunction,
    Lambda5, Lambda5_deps, Lambda5_toFunction,
    Lambda6, Lambda6_deps, Lambda6_toFunction,
    toSources, lambda1
} from "./Lambda";
import { Source, Vertex_, Vertex, CellVertex, ListenerVertex } from "./Vertex";
import { Transaction } from "./Transaction";
import { Lazy } from "./Lazy";
import { Listener } from "./Listener";
import { Stream } from "./Stream";
import { Operational } from "./Operational";
import { Tuple2 } from "./Tuple2";

class LazySample<A> {
    constructor(cell: Cell<A>) {
        this.cell = cell;
    }
    cell: Cell<A>;
    hasValue: boolean = false;
    value: A = null;
}

class ApplyState<A, B> {
    constructor() { }
    f: (a: A) => B = null;
    f_present: boolean = false;
    a: A = null;
    a_present: boolean = false;
}

export class Cell<A> {
    // protected value: A;

    vertex: CellVertex<A>;

    constructor(initValue?: A, str?: Stream<A>, vertex?: CellVertex<A>) {
        if (!!vertex) {
            this.vertex = vertex;
        } else {
            this.vertex = new CellVertex<A>(initValue!);
        }
    }

    protected setStream(str: Stream<A>) {
    }

    getVertex__(): Vertex_ {
        // return this.vertex;
        throw new Error();
    }

    getStream__(): Stream<A> {  // TO DO: Figure out how to hide this
        throw new Error();
    }

    sample(): A {
        // return Transaction.run(() => { return this.sampleNoTrans__(); });
        throw new Error();
    }

    sampleNoTrans__(): A {  // TO DO figure out how to hide this
        // return this.value;
        throw new Error();
    }

    /**
     * A variant of {@link sample()} that works with {@link CellLoop}s when they haven't been looped yet.
     * It should be used in any code that's general enough that it could be passed a {@link CellLoop}.
     * @see Stream#holdLazy(Lazy) Stream.holdLazy()
     */
    sampleLazy(): Lazy<A> {
        // const me = this;
        // return Transaction.run(() => me.sampleLazyNoTrans__());
        throw new Error();
    }

    sampleLazyNoTrans__(): Lazy<A> {  // TO DO figure out how to hide this
        throw new Error();
    }

    /**
     * Transform the cell's value according to the supplied function, so the returned Cell
     * always reflects the value of the function applied to the input Cell's value.
     * @param f Function to apply to convert the values. It must be <em>referentially transparent</em>.
     */
    map<B>(f: ((a: A) => B) | Lambda1<A, B>): Cell<B> {
        // const c = this;
        // return Transaction.run(() =>
        //     Operational.updates(c).map(f).holdLazy(c.sampleLazy().map(Lambda1_toFunction(f)))
        // );
        throw new Error();
    }

	/**
	 * Lift a binary function into cells, so the returned Cell always reflects the specified
	 * function applied to the input cells' values.
	 * @param fn Function to apply. It must be <em>referentially transparent</em>.
	 */
    lift<B, C>(b: Cell<B>,
        fn0: ((a: A, b: B) => C) |
            Lambda2<A, B, C>): Cell<C> {
        // const fn = Lambda2_toFunction(fn0),
        //     cf = this.map((aa : A) => (bb : B) => fn(aa, bb));
        // return Cell.apply(cf, b,
        //     toSources(Lambda2_deps(fn0)));
        throw new Error();
    }

	/**
	 * Lift a ternary function into cells, so the returned Cell always reflects the specified
	 * function applied to the input cells' values.
	 * @param fn Function to apply. It must be <em>referentially transparent</em>.
	 */
    lift3<B, C, D>(b: Cell<B>, c: Cell<C>,
        fn0: ((a: A, b: B, c: C) => D) |
            Lambda3<A, B, C, D>): Cell<D> {
        throw new Error();
    }

	/**
	 * Lift a quaternary function into cells, so the returned Cell always reflects the specified
	 * function applied to the input cells' values.
	 * @param fn Function to apply. It must be <em>referentially transparent</em>.
	 */
    lift4<B, C, D, E>(b: Cell<B>, c: Cell<C>, d: Cell<D>,
        fn0: ((a: A, b: B, c: C, d: D) => E) |
            Lambda4<A, B, C, D, E>): Cell<E> {
        throw new Error();
    }

	/**
	 * Lift a 5-argument function into cells, so the returned Cell always reflects the specified
	 * function applied to the input cells' values.
	 * @param fn Function to apply. It must be <em>referentially transparent</em>.
	 */
    lift5<B, C, D, E, F>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>,
        fn0: ((a: A, b: B, c: C, d: D, e: E) => F) |
            Lambda5<A, B, C, D, E, F>): Cell<F> {
        throw new Error();
    }

	/**
	 * Lift a 6-argument function into cells, so the returned Cell always reflects the specified
	 * function applied to the input cells' values.
	 * @param fn Function to apply. It must be <em>referentially transparent</em>.
	 */
    lift6<B, C, D, E, F, G>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>, f: Cell<F>,
        fn0: ((a: A, b: B, c: C, d: D, e: E, f: F) => G) |
            Lambda6<A, B, C, D, E, F, G>): Cell<G> {
        throw new Error();
    }

    /**
     * High order depenency traking. If any newly created sodium objects within a value of a cell of a sodium object
     * happen to accumulate state, this method will keep the accumulation of state up to date.
     */
    public tracking(extractor: (a: A) => (Stream<any> | Cell<any>)[]): Cell<A> {
        throw new Error();
    }

    /**
     * Lift an array of cells into a cell of an array.
     */
    public static liftArray<A>(ca: Cell<A>[]): Cell<A[]> {
        throw new Error();
    }

    private static _liftArray<A>(ca: Cell<A>[], fromInc: number, toExc: number): Cell<A[]> {
        throw new Error();
    }

	/**
	 * Apply a value inside a cell to a function inside a cell. This is the
	 * primitive for all function lifting.
	 */
    static apply<A, B>(cf: Cell<(a: A) => B>, ca: Cell<A>, sources?: Source[]): Cell<B> {
        throw new Error();
    }

	/**
	 * Unwrap a cell inside another cell to give a time-varying cell implementation.
	 */
    static switchC<A>(cca: Cell<Cell<A>>): Cell<A> {
        throw new Error();
    }

	/**
	 * Unwrap a stream inside a cell to give a time-varying stream implementation.
	 */
    static switchS<A>(csa: Cell<Stream<A>>): Stream<A> {
        throw new Error();

    }

    /**
     * When transforming a value from a larger type to a smaller type, it is likely for duplicate changes to become
     * propergated. This function insures only distinct changes get propergated.
     */
    calm(eq: (a: A, b: A) => boolean): Cell<A> {
        throw new Error();
    }

    /**
     * This function is the same as calm, except you do not need to pass an eq function. This function will use (===)
     * as its eq function. I.E. calling calmRefEq() is the same as calm((a,b) => a === b).
     */
    calmRefEq(): Cell<A> {
        throw new Error();
    }

	/**
	 * Listen for updates to the value of this cell. This is the observer pattern. The
	 * returned {@link Listener} has a {@link Listener#unlisten()} method to cause the
	 * listener to be removed. This is an OPERATIONAL mechanism is for interfacing between
	 * the world of I/O and for FRP.
	 * @param h The handler to execute when there's a new value.
	 *   You should make no assumptions about what thread you are called on, and the
	 *   handler should not block. You are not allowed to use {@link CellSink#send(Object)}
	 *   or {@link StreamSink#send(Object)} in the handler.
	 *   An exception will be thrown, because you are not meant to use this to create
	 *   your own primitives.
     */
    listen(h: (a: A) => void): () => void {
        h(this.vertex.oldValue);
        new ListenerVertex(this.vertex, h);
        return () => {};
    }
}