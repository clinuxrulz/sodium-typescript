import { Vertex } from './Vertex';

let enableDebugFlag = false;

function log(a: any): void {
  if (enableDebugFlag) {
    console.log(a);
  }
}

function visit(stack: Vertex[], vertex: Vertex) {
  if (vertex.visited) return;

  vertex.visited = true;

  vertex.dependents?.forEach((v) => {
      visit(stack, v);
  });

  stack.push(vertex);
}

export class Transaction {
  private roots = new Set<Vertex>();

  constructor() { }

  addRoot(root: Vertex) {
    this.roots.add(root);
  }

  close(): void {
    const topoSort = (roots: Set<Vertex>) => {
      const stack: Vertex[] = [];

      const desc = (vertex: Vertex) => {
        return `${vertex.constructor.name} [${vertex?.name || "unnamed"}]`;
      }

      roots.forEach((v) => {
        visit(stack, v);
      });

      stack.forEach((v) => v.reset());

      return stack;
    }

    const processed = new Set<Vertex>();

    while (this.roots.size != 0) {
      Transaction.log({ 
        roots: Array.from(this.roots).map((r) => r.describe()),
      });

      const stack = topoSort(this.roots);

      Transaction.log({ 
        stack: stack.map((v) => v.describe()),
      });

      this.roots.clear();

      for (let i = stack.length - 1; i >= 0; i--) {
        const vertex = stack[i];
        const isResortNeeded = vertex.process();
        processed.add(vertex);

        if (isResortNeeded) {
          log(`isResortNeeded`);
          for (let j = 0; j <= i; ++j) {
            const vertex_ = stack[j];
            this.roots.add(vertex_);
          }
          break;
        }
      }
    }

    processed.forEach((v) => v.notify());
    processed.forEach((v) => v.update());
  }

  static currentTransaction?: Transaction;

  static enableDebug(flag: boolean) {
    enableDebugFlag = flag;
  }

  static log(msg: any): void {
    if (enableDebugFlag) {
      console.log(msg);
    }
  }

  public static run<A>(f: (t: Transaction) => A): A {
    const ct = this.currentTransaction;

    if (!ct) {
      log(`Transaction start`);

      const t = new Transaction();

      this.currentTransaction = t;

      try {
        const a = f(t);

        t.close();

        return a;
      } finally {
        this.currentTransaction = undefined;

        log(`Transaction end`);
      }
    } else {
      return f(ct);
    }
  }
}
