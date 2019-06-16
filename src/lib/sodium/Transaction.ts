import {Vertex} from './Vertex';
import * as Collections from 'typescript-collections';

export class Action
{
  constructor(action: ()=>void) {
    this.action = action;
  }
  action: ()=>void;
  visited: boolean = false;
}

export class Entry
{
  constructor(rank: Vertex, actions: Collections.Dictionary<Vertex,Action[]>)
  {
    this.rank = rank;
    this.actions = actions;
  }

  rank: Vertex;
  actions: Collections.Dictionary<Vertex,Action[]>;

  toString(): string
  {
    return "" + this.rank.rank;
  }
}

export class Transaction
{
  public static currentTransaction: Transaction = null;
  private static onStartHooks: (() => void)[] = [];
  private static runningOnStartHooks: boolean = false;

  constructor() {}

  inCallback: number = 0;

  prioritizedMinIdx = -1;
  prioritizedQ: Entry[] = [];
  private sampleQ: Array<() => void> = [];
  private lastQ: Array<() => void> = [];
  private postQ: Array<() => void> = null;
  private static collectCyclesAtEnd: boolean = false;

  prioritized(target: Vertex, action: () => void): void
  {
    if (this.prioritizedMinIdx == -1) {
      this.prioritizedMinIdx = target.rank;
    } else {
      if (target.rank < this.prioritizedMinIdx) {
        this.prioritizedMinIdx = target.rank;
      }
    }
    let entry = this.prioritizedQ[target.rank];
    if (entry == undefined) {
      let actions = new Collections.Dictionary<Vertex,Action[]>(k => "" + k.id);
      entry = new Entry(target, actions);
      this.prioritizedQ[target.rank] = entry;
    }
    let actions = entry.actions.getValue(target);
    if (actions == undefined) {
      actions = [];
      entry.actions.setValue(target, actions);
    }
    actions.push(new Action(action));
  }

  sample(h: () => void): void
  {
    this.sampleQ.push(h);
  }

  last(h: () => void): void
  {
    this.lastQ.push(h);
  }

  public static _collectCyclesAtEnd(): void
  {
    Transaction.run(() => Transaction.collectCyclesAtEnd = true);
  }

  /**
   * Add an action to run after all last() actions.
   */
  post(childIx: number, action: () => void): void
  {
    if (this.postQ == null)
      this.postQ = [];
    // If an entry exists already, combine the old one with the new one.
    while (this.postQ.length <= childIx)
      this.postQ.push(null);
    const existing = this.postQ[childIx],
      neu =
        existing === null ? action
          : () =>
        {
          existing();
          action();
        };
    this.postQ[childIx] = neu;
  }

  public isActive() : boolean
  {
    return Transaction.currentTransaction ? true : false;
  }

  close(): void
  {
    while(true)
    {
      if (this.prioritizedMinIdx != -1) {
        for (let i = this.prioritizedMinIdx; i < this.prioritizedQ.length; ++i) {
          let entry = this.prioritizedQ[i];
          if (entry == undefined) {
            continue;
          }
          while (true) {
            let keys = entry.actions.keys();
            if (keys.length == 0) {
              break;
            }
            let key = keys[0];
            let actions = entry.actions.remove(key);
            if (actions == undefined) {
              continue;
            }
            for (let k = actions.length-1; k >= 0; --k) {
              // Actions may be removed during the execution of actions, so add an if-statement for safety.
              if (k < actions.length) {
                let action = actions.splice(k, 1)[0];
                if (action.visited) {
                  continue;
                }
                action.visited = true;
                action.action();
              }
            }
          }
        }
        this.prioritizedMinIdx = -1;
        this.prioritizedQ.splice(0, this.prioritizedQ.length);
      }

      const sq = this.sampleQ;
      this.sampleQ = [];
      for (let i = 0; i < sq.length; i++)
        sq[i]();

      if(this.prioritizedQ.length < 1 && this.sampleQ.length < 1) break;
    }

    for (let i = 0; i < this.lastQ.length; i++)
      this.lastQ[i]();
    this.lastQ = [];
    if (this.postQ != null)
    {
      for (let i = 0; i < this.postQ.length; i++)
      {
        if (this.postQ[i] != null)
        {
          const parent = Transaction.currentTransaction;
          try
          {
            if (i > 0)
            {
              Transaction.currentTransaction = new Transaction();
              try
              {
                this.postQ[i]();
                Transaction.currentTransaction.close();
              }
              catch (err)
              {
                Transaction.currentTransaction.close();
                throw err;
              }
            }
            else
            {
              Transaction.currentTransaction = null;
              this.postQ[i]();
            }
            Transaction.currentTransaction = parent;
          }
          catch (err)
          {
            Transaction.currentTransaction = parent;
            throw err;
          }
        }
      }
      this.postQ = null;
    }
  }

  /**
   * Add a runnable that will be executed whenever a transaction is started.
   * That runnable may start transactions itself, which will not cause the
   * hooks to be run recursively.
   *
   * The main use case of this is the implementation of a time/alarm system.
   */
  static onStart(r: () => void): void
  {
    Transaction.onStartHooks.push(r);
  }

  public static run<A>(f: () => A): A
  {
    const transWas: Transaction = Transaction.currentTransaction;
    if (transWas === null)
    {
      if (!Transaction.runningOnStartHooks)
      {
        Transaction.runningOnStartHooks = true;
        try
        {
          for (let i = 0; i < Transaction.onStartHooks.length; i++)
            Transaction.onStartHooks[i]();
        }
        finally
        {
          Transaction.runningOnStartHooks = false;
        }
      }
      Transaction.currentTransaction = new Transaction();
    }
    try
    {
      const a: A = f();
      if (transWas === null)
      {
        Transaction.currentTransaction.close();
        Transaction.currentTransaction = null;
        if (Transaction.collectCyclesAtEnd) {
          Vertex.collectCycles();
          Transaction.collectCyclesAtEnd = false;
        }
      }
      return a;
    }
    catch (err)
    {
      if (transWas === null)
      {
        Transaction.currentTransaction.close();
        Transaction.currentTransaction = null;
      }
      throw err;
    }
  }
}


