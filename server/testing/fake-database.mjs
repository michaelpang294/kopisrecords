export function database(stock = 1) {
  const state = {
    orders: new Map(),
    access: new Map(),
    holds: [],
    fulfilment: new Map(),
    events: [],
    stock,
  };
  let tail = Promise.resolve();
  const execute = async (sql, args = []) => {
    if (sql.startsWith("SELECT order_id FROM checkout_order_recovery"))
      return [
        [
          ...(state.access.has(args[0])
            ? [{ order_id: state.access.get(args[0]) }]
            : []),
        ],
      ];
    if (sql.startsWith("INSERT INTO checkout_order_recovery")) {
      state.access.set(args[0], args[1]);
      return [{}];
    }
    if (sql.startsWith("SELECT status FROM checkout_fulfilment"))
      return [
        [
          ...(state.fulfilment.has(args[0])
            ? [{ status: state.fulfilment.get(args[0]) }]
            : []),
        ],
      ];
    if (sql.startsWith("CREATE TABLE") || sql.startsWith("INSERT IGNORE"))
      return [{}];
    if (
      sql.startsWith("SELECT o.id") ||
      sql.startsWith("SELECT COUNT(*) AS total FROM checkout_orders")
    ) {
      let rows = [...state.orders.values()].map((o) => ({
        ...o,
        payment_status: o.status,
        status: state.fulfilment.get(o.id) || o.status,
      }));
      let index = 0;
      if (sql.includes(" WHERE o.id=?"))
        rows = rows.filter((o) => o.id === args[0]);
      if (sql.includes("COALESCE(f.status,o.status)=?")) {
        const status = args[index++];
        rows = rows.filter((o) => o.status === status);
      }
      if (sql.includes(" LIKE ?")) {
        const q = args[index].replaceAll("%", "").toLowerCase();
        rows = rows.filter((o) => {
          const d = JSON.parse(o.details);
          return [d.reference, d.name, d.contact].some((v) =>
            v.toLowerCase().includes(q),
          );
        });
      }
      if (sql.startsWith("SELECT COUNT")) return [[{ total: rows.length }]];
      const offset = Number(sql.match(/OFFSET (\d+)/)?.[1] || 0);
      return [structuredClone(rows.slice(offset, offset + 30))];
    }
    if (sql.startsWith("SELECT details FROM checkout_orders"))
      return [
        [
          ...(state.orders.has(args[0])
            ? [{ details: state.orders.get(args[0]).details }]
            : []),
        ],
      ];
    if (sql.startsWith("SELECT product_id,quantity,state,expires_at"))
      return [
        structuredClone(state.holds.filter((h) => h.order_id === args[0])),
      ];
    if (sql.startsWith("SELECT action,created_at"))
      return [
        structuredClone(
          state.events.filter((e) => e.order_id === args[0]).reverse(),
        ),
      ];
    if (sql.startsWith("INSERT INTO checkout_fulfilment")) {
      state.fulfilment.set(args[0], args[1]);
      return [{}];
    }
    if (sql.startsWith("INSERT INTO checkout_order_events")) {
      state.events.push({
        order_id: args[0],
        action: args[1],
        created_at: new Date().toISOString(),
      });
      return [{}];
    }
    if (sql.startsWith("UPDATE checkout_orders o SET")) {
      for (const o of state.orders.values())
        if (
          o.status === "awaiting_payment_confirmation" &&
          state.holds.some(
            (h) =>
              h.order_id === o.id &&
              h.state === "active" &&
              h.expires_at <= Date.now(),
          )
        )
          o.status = "expired";
      return [{}];
    }
    if (sql.startsWith("SELECT id FROM checkout_reservation_lock"))
      return [[{ id: 1 }]];
    if (sql.startsWith("SELECT * FROM checkout_orders WHERE id"))
      return [
        [
          ...(state.orders.has(args[0])
            ? [structuredClone(state.orders.get(args[0]))]
            : []),
        ],
      ];
    if (sql.startsWith("SELECT * FROM checkout_orders WHERE JSON_"))
      return [
        [...state.orders.values()]
          .filter((o) => JSON.parse(o.details).reference === args[0])
          .map((o) => structuredClone(o)),
      ];
    if (sql.startsWith("SELECT * FROM stock WHERE id"))
      return [
        [
          {
            id: 1,
            title: "Test",
            artist: "Artist",
            price: "40.00",
            stock: state.stock,
            tags: ["recommended"],
          },
        ],
      ];
    if (sql === "UPDATE stock SET stock = ? WHERE id = ?") {
      state.stock = args[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT id,title"))
      return [
        [
          {
            id: 1,
            title: "Test",
            artist: "Artist",
            price: "40.00",
            stock: state.stock,
          },
        ],
      ];
    if (sql.startsWith("SELECT COALESCE"))
      return [
        [
          {
            held: state.holds
              .filter(
                (h) =>
                  h.product_id === args[0] &&
                  (h.state === "reported" ||
                    (h.state === "active" && h.expires_at > Date.now())),
              )
              .reduce((s, h) => s + h.quantity, 0),
          },
        ],
      ];
    if (sql.startsWith("INSERT INTO checkout_orders")) {
      state.orders.set(args[0], {
        id: args[0],
        fingerprint: args[1],
        details: args[2],
        created_at: new Date().toISOString(),
        status: "awaiting_payment_confirmation",
      });
      return [{}];
    }
    if (sql.startsWith("INSERT INTO checkout_reservations")) {
      state.holds.push({
        order_id: args[0],
        product_id: args[1],
        quantity: args[2],
        expires_at: +args[3],
        state: "active",
      });
      return [{}];
    }
    if (sql.startsWith("SELECT * FROM checkout_reservations"))
      return [
        state.holds
          .filter((h) => h.order_id === args[0])
          .map((h) => ({ ...h })),
      ];
    if (sql.startsWith("UPDATE stock SET stock = stock -")) {
      if (state.stock < args[2]) return [{ affectedRows: 0 }];
      state.stock -= args[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE checkout_orders SET status")) {
      const status = sql.match(/status = '([^']+)'/)[1];
      state.orders.get(args[0]).status = status;
      return [{}];
    }
    if (sql.startsWith("UPDATE checkout_reservations SET state")) {
      const status = sql.match(/state = '([^']+)'/)[1];
      for (const h of state.holds) if (h.order_id === args[0]) h.state = status;
      return [{}];
    }
    throw Error(sql);
  };
  return {
    state,
    execute,
    async getConnection() {
      let unlock, snapshot;
      return {
        async beginTransaction() {
          const previous = tail;
          tail = new Promise((r) => (unlock = r));
          await previous;
          snapshot = structuredClone(state);
        },
        execute,
        async commit() {
          unlock();
        },
        async rollback() {
          Object.assign(state, snapshot);
          unlock();
        },
        release() {},
      };
    },
  };
}
