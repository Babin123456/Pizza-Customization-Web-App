import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { formatCurrency } from "../../utils/money";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const emptyStats = { totals: { orders: 0, users: 0, activeUsers: 0, pizzas: 0, availablePizzas: 0, toppings: 0, paidOrders: 0, codOrders: 0, pendingPayments: 0, deliveredOrders: 0, cancelledOrders: 0 }, money: { grossRevenue: 0, revenue: 0, netRevenue: 0, netWorth: 0, todayRevenue: 0, monthlyRevenue: 0, averageOrderValue: 0 }, performance: { conversionRate: 0, fulfillmentRate: 0, cancellationRate: 0 }, breakdowns: { orderStatus: {}, paymentStatus: {} }, recentOrders: [], topPizzas: [], revenueSeries: [], razorpay: { mode: "not_configured", detectedMode: "not_configured", isConfigured: false, isLive: false, keyPrefix: "missing" } };

const normalizeStats = (payload) => {
  const data = payload?.data || payload || {};
  return { ...emptyStats, totals: { ...emptyStats.totals, ...(data.totals || {}) }, money: { ...emptyStats.money, ...(data.money || {}) }, performance: { ...emptyStats.performance, ...(data.performance || {}) }, breakdowns: { ...emptyStats.breakdowns, ...(data.breakdowns || {}) }, recentOrders: data.recentOrders || [], topPizzas: data.topPizzas || [], revenueSeries: data.revenueSeries || [], razorpay: { ...emptyStats.razorpay, ...(data.razorpay || {}) } };
};

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

const buildFallbackStats = ({ orders = [], users = [], pizzas = [], toppings = [], razorpay = {} }) => {
  const paidOrders = orders.filter((o) => ["paid", "cod"].includes(o.paymentStatus));
  const grossRevenue = paidOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const todayRevenue = paidOrders.filter((o) => new Date(o.createdAt) >= startOfDay()).reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const monthlyRevenue = paidOrders.filter((o) => new Date(o.createdAt) >= startOfMonth()).reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const deliveredOrders = orders.filter((o) => o.orderStatus === "delivered").length;
  const cancelledOrders = orders.filter((o) => o.orderStatus === "cancelled").length;
  const topPizzaMap = paidOrders.reduce((acc, order) => {
    (order.items || []).forEach((item) => {
      const key = item.name || "Pizza";
      acc[key] = acc[key] || { _id: key, quantity: 0, revenue: 0 };
      acc[key].quantity += Number(item.qty) || 0;
      acc[key].revenue += (Number(item.price) || 0) * (Number(item.qty) || 0);
    });
    return acc;
  }, {});
  return normalizeStats({ totals: { orders: orders.length, users: users.length, activeUsers: users.filter((u) => u.status !== "inactive").length, pizzas: pizzas.length, availablePizzas: pizzas.filter((p) => p.isAvailable !== false).length, toppings: toppings.filter((t) => t.isAvailable !== false).length, paidOrders: orders.filter((o) => o.paymentStatus === "paid").length, codOrders: orders.filter((o) => o.paymentStatus === "cod").length, pendingPayments: orders.filter((o) => o.paymentStatus === "pending").length, deliveredOrders, cancelledOrders }, money: { grossRevenue, revenue: grossRevenue, netRevenue: grossRevenue, netWorth: grossRevenue, todayRevenue, monthlyRevenue, averageOrderValue: paidOrders.length ? Math.round(grossRevenue / paidOrders.length) : 0 }, performance: { conversionRate: orders.length ? Math.round((paidOrders.length / orders.length) * 100) : 0, fulfillmentRate: orders.length ? Math.round((deliveredOrders / orders.length) * 100) : 0, cancellationRate: orders.length ? Math.round((cancelledOrders / orders.length) * 100) : 0 }, recentOrders: orders.slice(0, 6), topPizzas: Object.values(topPizzaMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5), razorpay });
};

function Metric({ label, value }) { return <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"><span className="text-slate-300">{label}</span><span className="font-bold">{value}</span></div>; }

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setError(""); setNotice("");
        const res = await axios.get(`${apiUrl}/admin/stats`, { headers: { Authorization: `Bearer ${user.token}` } });
        setStats(normalizeStats(res.data));
      } catch (err) {
        try {
          const headers = { Authorization: `Bearer ${user.token}` };
          const [ordersRes, usersRes, pizzasRes, toppingsRes, paymentRes] = await Promise.all([
            axios.get(`${apiUrl}/orders`, { headers }), axios.get(`${apiUrl}/user/users`, { headers }), axios.get(`${apiUrl}/pizzas`), axios.get(`${apiUrl}/toppings`), axios.get(`${apiUrl}/payment/config`, { headers }).catch(() => ({ data: { data: emptyStats.razorpay } })),
          ]);
          setStats(buildFallbackStats({ orders: ordersRes.data.data || [], users: usersRes.data.data || [], pizzas: pizzasRes.data.data || [], toppings: toppingsRes.data.data || [], razorpay: paymentRes.data.data || emptyStats.razorpay }));
          setNotice("/admin/stats unavailable. Showing fallback live metrics.");
        } catch (fbErr) {
          setError(fbErr.response?.data?.error || err.response?.data?.error || "Failed to load admin dashboard");
        }
      } finally { setLoading(false); }
    };
    if (!user) navigate("/login"); else if (user.role !== "admin") navigate("/dashboard"); else load();
  }, [user, navigate]);

  const maxRevenue = useMemo(() => Math.max(1, ...stats.revenueSeries.map((i) => i.revenue || 0)), [stats.revenueSeries]);
  const cards = [
    { t: "Net Worth", v: formatCurrency(stats.money.netWorth), n: "Business value" },
    { t: "Revenue", v: formatCurrency(stats.money.grossRevenue), n: `${formatCurrency(stats.money.todayRevenue)} today` },
    { t: "Monthly", v: formatCurrency(stats.money.monthlyRevenue), n: `${formatCurrency(stats.money.averageOrderValue)} avg order` },
    { t: "Pending", v: stats.totals.pendingPayments, n: "Needs follow-up" },
  ];

  return <main className="min-h-screen text-white">
    <div className="mb-8 flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.35em] text-orange-300">Command Center</p><h1 className="text-4xl font-black">Admin Dashboard</h1><p className="text-slate-400">Production analytics for revenue, operations, and customers.</p></div><div className={`rounded-xl border px-4 py-2 ${stats.razorpay.isLive ? "border-emerald-300/30" : "border-amber-300/30"}`}>Razorpay: {stats.razorpay.isLive ? "Live" : stats.razorpay.isConfigured ? "Test" : "Off"}</div></div>
    {error && <div className="mb-4 rounded-xl border border-red-300/30 bg-red-500/10 p-3">{error}</div>}
    {notice && !error && <div className="mb-4 rounded-xl border border-sky-300/30 bg-sky-500/10 p-3">{notice}</div>}
    {loading ? <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/10" />)}</div> : <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <div key={c.t} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-slate-400">{c.t}</p><p className="mt-2 text-3xl font-black">{c.v}</p><p className="text-xs text-slate-400">{c.n}</p></div>)}</section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">7-day Revenue</h2><Link to="/admin/orders" className="rounded-full bg-orange-500 px-3 py-1 text-sm">View orders</Link></div><div className="flex h-64 items-end gap-2 rounded-xl bg-black/20 p-3">{stats.revenueSeries.length ? stats.revenueSeries.map((i) => <div key={i._id} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-orange-400" style={{ height: `${Math.max(8, ((i.revenue || 0) / maxRevenue) * 100)}%` }} /><span className="text-[10px] text-slate-400">{i._id?.slice(5)}</span></div>) : <p className="m-auto text-slate-400">No revenue yet</p>}</div></div>
      <div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2"><h3 className="font-black">Operations</h3><Metric label="Orders" value={stats.totals.orders} /><Metric label="Delivered" value={stats.totals.deliveredOrders} /><Metric label="Fulfillment" value={`${stats.performance.fulfillmentRate}%`} /><Metric label="Cancellation" value={`${stats.performance.cancellationRate}%`} /></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2"><h3 className="font-black">Users & Menu</h3><Metric label="Users" value={stats.totals.users} /><Metric label="Active" value={stats.totals.activeUsers} /><Metric label="Pizzas Live" value={`${stats.totals.availablePizzas}/${stats.totals.pizzas}`} /><Metric label="Toppings" value={stats.totals.toppings} /></div></div></section>
      <section className="mt-6 grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"><h3 className="text-lg font-black">Top Pizzas</h3>{stats.topPizzas.length ? stats.topPizzas.map((p, idx) => <div key={p._id || idx} className="flex justify-between rounded-xl bg-black/20 p-3"><div><p className="font-bold">#{idx + 1} {p._id}</p><p className="text-xs text-slate-400">{p.quantity} sold</p></div><p className="font-black">{formatCurrency(p.revenue)}</p></div>) : <p className="text-slate-400">No sales yet.</p>}</div><div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"><h3 className="text-lg font-black">Recent Orders</h3>{stats.recentOrders.length ? stats.recentOrders.map((o) => <div key={o._id} className="flex justify-between rounded-xl bg-black/20 p-3"><div><p className="font-bold">#{o._id?.slice(-6)} • {o.user?.name || "Guest"}</p><p className="text-xs text-slate-400">{o.orderStatus} • {o.paymentStatus}</p></div><p className="font-black">{formatCurrency(o.totalAmount)}</p></div>) : <p className="text-slate-400">No orders yet.</p>}</div></section>
    </>}
  </main>;
}
