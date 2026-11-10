export function database(stock = 1) {
  const state = {
    preorders: new Map(),
    preorderItems: new Map(),
    preorderEmails: new Map(),
    products: new Map(),
    productTags: ["recommended"],
    orders: new Map(),
    emails: new Map(),
    alerts: new Map(),
    optins: new Map(),
    productPresent: true,
    access: new Map(),
    holds: [],
    fulfilment: new Map(),
    events: [],
    stock,
  };
  let tail = Promise.resolve();
  const execute = async (sql, args = []) => {
    if (state.products.size && sql.startsWith("SELECT id,title")) return [[...state.products.values()].filter((p)=>args.includes(p.id)).map((p)=>structuredClone(p))];
    if (state.products.size && sql.startsWith("SELECT * FROM stock WHERE id")) return [state.products.has(args[0])?[structuredClone(state.products.get(args[0]))]:[]];
    if (state.products.size && sql.startsWith("UPDATE stock SET stock = stock -")) {const p=state.products.get(args[1]);if(!p||p.stock<args[2])return [{affectedRows:0}];p.stock-=args[0];return [{affectedRows:1}];}

    if (sql.startsWith("SELECT m.product_id")) return [[...state.preorderItems.values()].filter((m) => m.order_id===args[0]).map((m) => ({ product_id:m.product_id,...state.preorders.get(m.product_id) }))];
    if (sql === "SELECT product_id,status,expected_arrival,version FROM product_preorders") return [[...state.preorders.values()].map((r)=>structuredClone(r))];
    if (sql.startsWith("INSERT IGNORE INTO product_preorders")) {
      if (args.length && !state.preorders.has(args[0])) state.preorders.set(args[0],{product_id:args[0],status:'awaiting_release',expected_arrival:null,version:0});
      return [{affectedRows:1}];
    }
    if (sql.startsWith("INSERT IGNORE INTO checkout_preorder_items")) {
      if(args.length) state.preorderItems.set(args[0]+'|'+args[1],{order_id:args[0],product_id:args[1]});
      return [{affectedRows:1}];
    }
    if (sql.startsWith("SELECT product_id,status,expected_arrival,version FROM product_preorders WHERE")) return [state.preorders.has(args[0])?[structuredClone(state.preorders.get(args[0]))]:[]];
    if (sql.startsWith("UPDATE product_preorders SET")) {Object.assign(state.preorders.get(args[3]),{status:args[0],expected_arrival:args[1],version:args[2]});return [{affectedRows:1}];}
    if (sql.startsWith("SELECT o.id,o.details FROM checkout_preorder_items")) return [[...state.preorderItems.values()].filter((m)=>m.product_id===args[0]).flatMap((m)=>{const o=state.orders.get(m.order_id);return o&&['payment_reported','paid'].includes(o.status)&&['payment_reported','paid'].includes(state.fulfilment.get(o.id)?.status||state.fulfilment.get(o.id)||o.status)?[structuredClone(o)]:[]})];
    if (sql.startsWith("INSERT IGNORE INTO preorder_emails")) {
      const key=args[0]+'|'+args[1]+'|'+args[2];if(state.preorderEmails.has(key))return [{affectedRows:0}];
      state.preorderEmails.set(key,{order_id:args[0],product_id:args[1],version:args[2],payload:args[3],status:'pending',attempts:0,next_attempt_at:new Date(0)});return [{affectedRows:1}];
    }
    if (sql.startsWith("SELECT order_id,product_id,version,payload FROM preorder_emails")) return [[...state.preorderEmails.values()].filter((j)=>['pending','failed'].includes(j.status)&&j.attempts<5&&+new Date(j.next_attempt_at)<=Date.now()).map((r)=>structuredClone(r))];
    if (sql.startsWith("SELECT o.details,o.status,COALESCE")) {const o=state.orders.get(args[1]),p=state.preorders.get(args[0]);return [o&&p?[{...structuredClone(o),fulfilment_status:state.fulfilment.get(o.id)?.status||state.fulfilment.get(o.id)||o.status,version:p.version}]:[]]}
    if (sql.startsWith("SELECT COUNT(*) AS total FROM preorder_emails")) return [[{total:[...state.preorderEmails.values()].filter(j=>j.status==='failed').length}]];
    if (sql.startsWith("UPDATE preorder_emails")) {
      if(sql.includes("SET status='pending'")){for(const j of state.preorderEmails.values())if(j.status==='failed')Object.assign(j,{status:'pending',attempts:0,next_attempt_at:new Date(0)});return [{affectedRows:1}];}
      const sending=sql.includes("SET status='sending'"),failed=sql.includes("SET status='failed'");
      const [id,product,version,claim]=sending?args.slice(1):failed?args.slice(1):args;
      const j=state.preorderEmails.get(id+'|'+product+'|'+version);if(!j)return [{affectedRows:0}];
      if(sending){if(!['pending','failed'].includes(j.status)||j.attempts>=5||+new Date(j.next_attempt_at)>Date.now())return [{affectedRows:0}];Object.assign(j,{status:'sending',claim:args[0],attempts:j.attempts+1});}
      else if(j.claim!==claim)return [{affectedRows:0}];
      else if(failed)Object.assign(j,{status:'failed',last_error:args[0],next_attempt_at:new Date(Date.now()+60000)});
      else Object.assign(j,{status:sql.includes("SET status='sent'")?'sent':'skipped'});
      return [{affectedRows:1}];
    }
    if(sql === "SELECT * FROM stock ORDER BY id DESC") return [[{id:1,title:'Test',artist:'Artist',medium:'Vinyl',variant:'Test pressing',price:'40.00',stock:state.stock,tags:state.productTags}]];
    if (sql.startsWith("SELECT * FROM restock_optins"))
      return [state.optins.has(args[0]+"|"+args[1]) ? [structuredClone(state.optins.get(args[0]+"|"+args[1]))] : []];
    if (sql.startsWith("INSERT INTO restock_optins")) {
      state.optins.set(args[0]+"|"+args[1], { alert_id: args[0], generation: args[1], status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), confirmed_at: null });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT v.alert_id,v.generation,a.email"))
      return [[...state.optins.values()].filter((v) => {
        const a=state.alerts.get(v.alert_id);
        return state.productPresent && a && a.generation===v.generation && a.status==='unconfirmed' &&
          (v.status==='pending'||(v.status==='failed'&&v.attempts<5)) && +new Date(v.next_attempt_at)<=Date.now();
      }).slice(0,10).map((v)=>({...structuredClone(v),email:state.alerts.get(v.alert_id).email,artist:'Artist',title:'Test'}))];
    if (sql.startsWith("SELECT v.alert_id,v.generation,v.expires_at"))
      return [[...state.optins.values()].filter((v) => v.token_hash===args[0] && state.alerts.get(v.alert_id)?.generation===v.generation).map((v)=>structuredClone(v))];
    if (sql.startsWith("UPDATE restock_optins")) {
      if (sql.includes("SET status = 'pending'")) {
        for(const v of state.optins.values()) if(v.status==='failed') Object.assign(v,{status:'pending',attempts:0,next_attempt_at:new Date().toISOString()});
        return [{affectedRows:1}];
      }
      if (sql.includes("SET status = 'sending'")) {
        const v=state.optins.get(args[2]+'|'+args[3]);
        if(!v||!['pending','failed'].includes(v.status)||v.attempts>=5||+new Date(v.next_attempt_at)>Date.now())return [{affectedRows:0}];
        Object.assign(v,{status:'sending',claim:args[0],token_hash:args[1],expires_at:new Date(Date.now()+86400000).toISOString(),attempts:v.attempts+1});
        return [{affectedRows:1}];
      }
      if (sql.includes("SET status = 'confirmed'")) {
        Object.assign(state.optins.get(args[0]+'|'+args[1]),{status:'confirmed',confirmed_at:new Date().toISOString()});
        return [{affectedRows:1}];
      }
      const failed=sql.includes("SET status = 'failed'");
      const [id,gen,claim]=failed?args.slice(1):args; const v=state.optins.get(id+'|'+gen);
      if(!v||v.claim!==claim||v.status!=='sending')return [{affectedRows:0}];
      v.status=failed?'failed':'sent';v.last_error=failed?args[0]:null;
      if(failed)v.next_attempt_at=new Date(Date.now()+60000).toISOString();else v.sent_at=new Date().toISOString();
      return [{affectedRows:1}];
    }
    if (sql.startsWith("SELECT a.alert_id FROM restock_alerts")) {
      const held = state.holds.filter((h) => h.product_id === 1 &&
        (h.state === "reported" || (h.state === "active" && h.expires_at > Date.now())))
        .reduce((sum, h) => sum + h.quantity, 0);
      return [[...state.alerts.values()].filter((a) => state.productPresent && a.product_id === 1 && state.stock > held &&
        (!sql.includes('INNER JOIN restock_optins') || state.optins.get(a.alert_id+'|'+a.generation)?.confirmed_at) &&
        (a.status === "waiting" || (a.status === "failed" && a.attempts < 5)) && +new Date(a.next_attempt_at) <= Date.now())
        .slice(0, 10).map((a) => ({ alert_id: a.alert_id }))];
    }
    if (sql.startsWith("SELECT * FROM restock_alerts WHERE product_id"))
      return [structuredClone([...state.alerts.values()].filter((a) => a.product_id === args[0] && a.email === args[1]))];
    if (sql.startsWith("SELECT * FROM restock_alerts WHERE alert_id"))
      return [state.alerts.has(args[0]) ? [structuredClone(state.alerts.get(args[0]))] : []];
    if (sql.startsWith("SELECT COUNT(*) AS total,COALESCE(SUM(email")) {
      const recent = [...state.alerts.values()].filter((a) => +new Date(a.created_at) > Date.now() - 3600000);
      return [[{ total: recent.length, customer: recent.filter((a) => a.email === args[0]).length,
        source: recent.filter((a) => a.ip_hash === args[1]).length }]];
    }
    if (sql.startsWith("INSERT INTO restock_alerts")) {
      const [alert_id, generation, product_id, email, ip_hash] = args;
      state.alerts.set(alert_id, { alert_id, generation, product_id, email, ip_hash, status: sql.includes("'unconfirmed'") ? "unconfirmed" : "waiting", attempts: 0,
        next_attempt_at: new Date().toISOString(), created_at: new Date().toISOString(), claim: null });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE restock_alerts")) {
      if (sql.includes("AND status = 'unconfirmed'")) {
        const a=state.alerts.get(args[0]);
        if(a?.generation===args[1]&&a.status==='unconfirmed') a.status='waiting';
        return [{affectedRows:1}];
      }
      if (sql.includes("SET generation = ?")) {
        const a = state.alerts.get(args[2]);
        if (!a || (!sql.includes("'unconfirmed'") && a.status !== "sent")) return [{ affectedRows: 0 }];
        Object.assign(a, { generation: args[0], ip_hash: args[1], status: sql.includes("'unconfirmed'") ? "unconfirmed" : "waiting", attempts: 0, claim: null,
          next_attempt_at: new Date().toISOString(), sent_at: null, created_at: new Date().toISOString() });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("WHERE status = 'failed'")) {
        for (const a of state.alerts.values()) if (a.status === "failed")
          Object.assign(a, { status: "waiting", attempts: 0, next_attempt_at: new Date().toISOString() });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SET status = 'sending'")) {
        const a = state.alerts.get(args[1]);
        if (!a || a.generation !== args[2] || !["waiting", "failed"].includes(a.status) || a.attempts >= 5 || +new Date(a.next_attempt_at) > Date.now())
          return [{ affectedRows: 0 }];
        Object.assign(a, { status: "sending", claim: args[0], attempts: a.attempts + 1 });
        return [{ affectedRows: 1 }];
      }
      const failed = sql.includes("SET status = 'failed'");
      const [id, generation, claim] = failed ? args.slice(1) : args;
      const a = state.alerts.get(id);
      if (!a || a.generation !== generation || a.claim !== claim || a.status !== "sending") return [{ affectedRows: 0 }];
      a.status = failed ? "failed" : "sent";
      a.last_error = failed ? args[0] : null;
      if (failed) a.next_attempt_at = new Date(Date.now() + 60000).toISOString();
      else a.sent_at = new Date().toISOString();
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("INSERT IGNORE INTO checkout_emails")) {
      const key = args[0] + "|" + args[1];
      if (state.emails.has(key)) return [{ affectedRows: 0 }];
      state.emails.set(key, {
        order_id: args[0],
        kind: args[1],
        status: "pending",
        attempts: 0,
        next_attempt_at: Date.now(),
        created_at: Date.now(),
      });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT order_id,kind FROM checkout_emails"))
      return [
        [...state.emails.values()]
          .filter(
            (e) =>
              (e.status === "pending" ||
                (e.status === "failed" && e.attempts < 5)) &&
              e.next_attempt_at <= Date.now(),
          )
          .slice(0, 10)
          .map((e) => ({ order_id: e.order_id, kind: e.kind })),
      ];
    if (sql.startsWith("SELECT kind,status,attempts"))
      return [
        structuredClone(
          [...state.emails.values()].filter((e) => e.order_id === args[0]),
        ),
      ];
    if (sql.startsWith("UPDATE checkout_emails")) {
      if (sql.includes("SET status = 'pending'")) {
        for (const e of state.emails.values())
          if (e.order_id === args[0] && e.status === "failed") {
            e.status = "pending";
            e.attempts = 0;
            e.next_attempt_at = Date.now();
          }
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SET status = 'sending'")) {
        const e = state.emails.get(args[1] + "|" + args[2]);
        if (
          !e ||
          !(
            e.status === "pending" ||
            (e.status === "failed" && e.attempts < 5)
          ) ||
          e.next_attempt_at > Date.now()
        )
          return [{ affectedRows: 0 }];
        e.status = "sending";
        e.claim = args[0];
        e.attempts++;
        return [{ affectedRows: 1 }];
      }
      const failed = sql.includes("SET status = 'failed'");
      const [id, kind, claim] = failed ? args.slice(1) : args;
      const e = state.emails.get(id + "|" + kind);
      if (!e || e.claim !== claim) return [{ affectedRows: 0 }];
      e.status = sql.match(/SET status = '([^']+)'/)[1];
      e.last_error = failed ? args[0] : null;
      if (failed) e.next_attempt_at = Date.now() + 60000;
      if (e.status === "sent") e.sent_at = new Date().toISOString();
      return [{ affectedRows: 1 }];
    }
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
      if (sql.includes("WHERE o.id<>?"))
        return [
          rows.filter((o) =>
            o.id !== args[0] &&
            o.payment_status === "paid" &&
            o.status === "ready_for_collection" &&
            String(JSON.parse(o.details).collectionNumber) === args[1],
          ).map((o) => ({ id: o.id })),
        ];
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
          return [d.reference, d.name, d.contact, d.email, d.telegram, d.collectionNumber]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
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
        !state.productPresent || args[0] !== 1 ? [] : [
          {
            id: 1,
            title: "Test",
            artist: "Artist",
            price: "40.00",
            stock: state.stock,
            tags: state.productTags,
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
            tags: state.productTags,
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
    if (sql.startsWith("UPDATE checkout_orders SET details = ?")) {
      state.orders.get(args[1]).details = args[0];
      return [{ affectedRows: 1 }];
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
