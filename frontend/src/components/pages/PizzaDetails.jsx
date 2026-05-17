import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../../api/axios";
import { demoToppings } from "../../features/pizza/demoData";
import { fetchPizzaById } from "../../features/pizza/pizzaService";
import { addItemToCart } from "../../features/cart/cartSlice";
import { formatCurrency } from "../../utils/money";

const renderStars = (rating = 0) => Array.from({ length: 5 }, (_, i) => (i < Math.round(rating) ? "★" : "☆")).join("");

function PizzaDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { isLoading: isCartLoading } = useSelector((state) => state.cart);

  const [pizza, setPizza] = useState(null);
  const [size, setSize] = useState(null);
  const [crust, setCrust] = useState(null);
  const [toppings, setToppings] = useState([]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingDemoToppings, setUsingDemoToppings] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const pizzaData = await fetchPizzaById(id);
        if (!pizzaData) throw new Error("Pizza not found");
        setPizza(pizzaData);
        setSize(pizzaData.sizes?.[0] || null);
        setCrust(pizzaData.crusts?.[0] || null);
        try {
          const toppingRes = await api.get("/toppings");
          const liveToppings = toppingRes.data.data || [];
          setToppings(liveToppings.length ? liveToppings : demoToppings);
          setUsingDemoToppings(!liveToppings.length);
        } catch {
          setToppings(demoToppings);
          setUsingDemoToppings(true);
        }
      } catch (err) {
        setError(err.message || "Failed to load pizza data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const toggleTopping = (topping) => setSelectedToppings((current) => current.some((item) => item._id === topping._id) ? current.filter((item) => item._id !== topping._id) : [...current, topping]);

  const unitPrice = useMemo(() => {
    if (!pizza) return 0;
    const toppingTotal = selectedToppings.reduce((sum, topping) => sum + (Number(topping.price) || 0), 0);
    return (Number(pizza.basePrice) || 0) + (Number(size?.price) || 0) + (Number(crust?.price) || 0) + toppingTotal;
  }, [pizza, size, crust, selectedToppings]);

  const totalPrice = unitPrice * qty;
  const reviews = pizza?.reviews || [];
  const averageRating = Number(pizza?.rating || 0);

  const addToCartHandler = async () => {
    if (!user) return navigate("/login");
    if (!size || !crust) return setError("Please select size and crust before adding to cart.");
    const item = { pizzaId: pizza._id, name: pizza.name, image: pizza.image, size, crust, toppings: selectedToppings, price: unitPrice, qty };
    const result = await dispatch(addItemToCart(item));
    if (addItemToCart.fulfilled.match(result)) navigate("/cart");
    else setError(result.payload || "Unable to add item to cart.");
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!user) return navigate("/login");
    if (id?.startsWith("demo-")) return setReviewError("Demo pizzas cannot save live reviews. Add this pizza from admin first.");
    if (!reviewComment.trim() || reviewComment.trim().length < 3) return setReviewError("Please write at least 3 characters in your review.");
    try {
      setReviewLoading(true);
      setReviewError("");
      setReviewSuccess("");
      const res = await api.post(`/pizzas/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      setPizza(res.data.data);
      setReviewComment("");
      setReviewSuccess(res.data.message || "Review saved successfully.");
    } catch (err) {
      setReviewError(err.response?.data?.error || "Failed to save review.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen px-6 py-20 text-white">Loading pizza details...</div>;
  if (error) return <div className="min-h-screen px-6 py-20 text-red-300">{error}</div>;
  if (!pizza) return null;

  return (
    <main className="min-h-screen text-white">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
          <Link to="/menu" className="text-sm text-orange-300">← Back to menu</Link>
          <img src={pizza.image} alt={pizza.name} className="mt-4 h-72 w-full rounded-2xl object-cover" />
          <h1 className="mt-4 text-3xl font-black">{pizza.name}</h1>
          <p className="text-slate-300">{pizza.description}</p>
          <p className="mt-2 text-amber-300">{renderStars(averageRating)} ({reviews.length} reviews)</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
          <h2 className="text-2xl font-black">Customize your pizza</h2>
          {usingDemoToppings && <p className="mt-2 text-xs text-amber-300">Using demo toppings (live endpoint unavailable)</p>}
          <div className="mt-4"><p className="text-sm text-slate-400">Size</p><div className="mt-2 flex flex-wrap gap-2">{(pizza.sizes || []).map((s) => <button key={s.name} onClick={() => setSize(s)} className={`rounded-full px-3 py-1 ${size?.name === s.name ? "bg-orange-500" : "bg-white/10"}`}>{s.name} (+{formatCurrency(s.price || 0)})</button>)}</div></div>
          <div className="mt-4"><p className="text-sm text-slate-400">Crust</p><div className="mt-2 flex flex-wrap gap-2">{(pizza.crusts || []).map((c) => <button key={c.name} onClick={() => setCrust(c)} className={`rounded-full px-3 py-1 ${crust?.name === c.name ? "bg-orange-500" : "bg-white/10"}`}>{c.name} (+{formatCurrency(c.price || 0)})</button>)}</div></div>
          <div className="mt-4"><p className="text-sm text-slate-400">Toppings</p><div className="mt-2 flex flex-wrap gap-2">{toppings.map((t) => <button key={t._id || t.name} onClick={() => toggleTopping(t)} className={`rounded-full px-3 py-1 ${selectedToppings.some((x) => x._id === t._id) ? "bg-emerald-500" : "bg-white/10"}`}>{t.name} (+{formatCurrency(t.price || 0)})</button>)}</div></div>
          <div className="mt-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">Quantity</p><div className="mt-1 flex items-center gap-2"><button onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded bg-white/10 px-3">-</button><span>{qty}</span><button onClick={() => setQty((q) => q + 1)} className="rounded bg-white/10 px-3">+</button></div></div><div className="text-right"><p className="text-sm text-slate-400">Total</p><p className="text-2xl font-black">{formatCurrency(totalPrice)}</p></div></div>
          <button onClick={addToCartHandler} disabled={isCartLoading} className="mt-5 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 font-bold">{isCartLoading ? "Adding..." : "Add to Cart"}</button>
        </section>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
          <h3 className="text-xl font-black">Write a review</h3>
          <form onSubmit={submitReview} className="mt-4 space-y-3">
            <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="w-full rounded-lg bg-black/30 p-2">
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Star</option>)}
            </select>
            <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="h-28 w-full rounded-lg bg-black/30 p-3" placeholder="Share your experience..." />
            <button disabled={reviewLoading} className="rounded-lg bg-sky-500 px-4 py-2 font-semibold">{reviewLoading ? "Saving..." : "Submit Review"}</button>
            {reviewError && <p className="text-red-300">{reviewError}</p>}
            {reviewSuccess && <p className="text-emerald-300">{reviewSuccess}</p>}
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
          <h3 className="text-xl font-black">Customer reviews ({reviews.length})</h3>
          <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-2">
            {reviews.length ? reviews.map((review, idx) => <div key={review._id || idx} className="rounded-xl bg-black/20 p-3"><p className="font-semibold">{review.name || review.user?.name || "Customer"}</p><p className="text-amber-300">{renderStars(Number(review.rating || 0))}</p><p className="text-slate-300">{review.comment}</p></div>) : <p className="text-slate-400">No reviews yet. Be the first to review.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default PizzaDetails;
