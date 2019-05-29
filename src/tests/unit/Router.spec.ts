import {
    Cell,
    Router,
    StreamSink,
    getTotalRegistrations
} from '../../lib/Lib';

afterEach(() => {
    if (getTotalRegistrations() != 0) {
        throw new Error('listeners were not deregistered');
    }
});

test('should test Router', (done) => {
    let out: string[] = [];
    let sa = new StreamSink<number[]>();
    let router = new Router(sa, x => x);
    let sb = router.filterIncludes(1).mapTo("a");
    let sc = router.filterIncludes(2).mapTo("b");
    let sd = router.filterIncludes(3).mapTo("c");
    let kill = sb.merge(sc, (x,y) => x+y).merge(sd, (x,y) => x+y).listen(x => out.push(x));
    let kills = [sb.listen(() => {}), sc.listen(() => {}), sd.listen(() => {})];
    let kill2 = () => kills.forEach(x => x());
    sa.send([1]);
    sa.send([2]);
    sa.send([3]);
    sa.send([1,2,3]);
    kill();
    kill2();
    expect(out).toEqual(["a", "b", "c", "abc"]);
    done();
});
