import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF, useProgress } from '@react-three/drei';
import './App.css';
import * as THREE from 'three';

/* Where the Laravel backend is running. */
const API_URL = 'http://localhost:8000';

/* ------------------------------------------------------------------
   RACK SETTINGS (scene units)
------------------------------------------------------------------- */
const RAIL_Y = 3.9;
const SPACING = 1.35;
const HANG_Y = RAIL_Y - 0.1;
const SELECTED_POS = [0, 1.9, 2.2];
const SELECTED_SCALE = 1.3;
const TWO_PI = Math.PI * 2;

const rackX = (index, count) => (index - (count - 1) / 2) * SPACING;

/* The cart remembers only which variant and how many. Names, prices and
   stock are always read fresh from the backend. */
const CART_KEY = 'thread3d-cart';

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e) => e && Number.isInteger(e.variantId) && Number.isInteger(e.qty) && e.qty > 0
    );
  } catch {
    return [];
  }
}

/* Shows an amount in a currency, e.g. NGN 12,000.00 or $7.80. */
function formatMoney(amount, code) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${code} ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

const CURRENCY_KEY = 'thread3d-currency';

function loadCurrencyCode() {
  try {
    return localStorage.getItem(CURRENCY_KEY) || '';
  } catch {
    return '';
  }
}

function Rack({ count }) {
  const half = (Math.max(count, 3) * SPACING) / 2 + 0.4;
  const metal = (
    <meshStandardMaterial color="#9aa7b8" metalness={0.8} roughness={0.35} />
  );
  return (
    <group>
      <mesh position={[0, RAIL_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, half * 2, 24]} />
        {metal}
      </mesh>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, RAIL_Y / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, RAIL_Y, 16]} />
          {metal}
        </mesh>
      ))}
    </group>
  );
}

function Hanger({ x }) {
  return (
    <group position={[x, HANG_Y, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#c9a36b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.04, 0.008, 8, 24]} />
        <meshStandardMaterial color="#c9a36b" roughness={0.5} />
      </mesh>
    </group>
  );
}

/* Where things sit for each display style. */
const SHELF_Y = 1.2;
const PLATFORM_TOP = 0.12;

const PLACEMENTS = {
  // hangs from the rail, turned side-on; comes forward when chosen
  hang: {
    rest: (x) => [x, HANG_Y, 0],
    restRot: Math.PI / 2,
    selected: SELECTED_POS,
    selectedScale: SELECTED_SCALE,
  },
  // stands on the shelf, angled slightly; comes forward when chosen
  stand: {
    rest: (x) => [x, SHELF_Y, 0],
    restRot: 0.35,
    selected: [0, 0.7, 2.2],
    selectedScale: 1.4,
  },
  // sits on the platform and turns slowly
  turntable: {
    rest: () => [0, PLATFORM_TOP, 0],
    restRot: 0,
    selected: [0, PLATFORM_TOP, 0],
    selectedScale: 1,
  },
};

const VIEWS = {
  rack: { mode: 'hang', camera: [0, 2.1, 7.2], target: [0, 2.0, 0] },
  shelf: { mode: 'stand', camera: [0, 1.6, 7.2], target: [0, 1.1, 0] },
  turntable: { mode: 'turntable', camera: [0, 1.5, 5.2], target: [0, 0.8, 0] },
};

function Shelf({ count }) {
  const width = Math.max(count, 3) * SPACING + 0.8;
  const wood = <meshStandardMaterial color="#6b5a47" roughness={0.7} />;
  return (
    <group>
      <mesh position={[0, SHELF_Y - 0.04, 0]}>
        <boxGeometry args={[width, 0.08, 1.0]} />
        {wood}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.1), (SHELF_Y - 0.08) / 2, 0]}>
          <boxGeometry args={[0.08, SHELF_Y - 0.08, 0.9]} />
          {wood}
        </mesh>
      ))}
    </group>
  );
}

function Platform() {
  return (
    <mesh position={[0, PLATFORM_TOP / 2, 0]}>
      <cylinderGeometry args={[1.3, 1.3, PLATFORM_TOP, 64]} />
      <meshStandardMaterial color="#3a4a5e" metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

/* One product in the scene. The model is measured when it loads and scaled
   and positioned automatically, so any uploaded product works without
   hand-tuned numbers.
   mode 'hang'      : top of the product sits at the hanger
   mode 'stand'     : bottom of the product sits on the shelf
   mode 'turntable' : bottom sits on the platform, always turning */
function Garment({ url, x, selected, onSelect, mode, targetHeight }) {
  const { scene } = useGLTF(url);

  const { garment, fit } = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = targetHeight / (size.y || 1);
    const y = mode === 'hang' ? -(box.max.y - size.y * 0.06) * s : -box.min.y * s;
    return {
      garment: clone,
      fit: { scale: s, position: [-center.x * s, y, -center.z * s] },
    };
  }, [scene, mode, targetHeight]);

  const placement = PLACEMENTS[mode];
  const group = useRef();
  const spin = useRef(0);
  const drag = useRef({ active: false, x: 0 });
  const initialised = useRef(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (mode !== 'turntable' && !selected && group.current) {
      spin.current = 0;
      drag.current.active = false;
      group.current.rotation.y =
        THREE.MathUtils.euclideanModulo(group.current.rotation.y + Math.PI, TWO_PI) -
        Math.PI;
    }
  }, [selected, mode]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);

    const targetPos = selected ? placement.selected : placement.rest(x);
    const targetScale = selected ? placement.selectedScale : hovered ? 1.04 : 1;

    if (mode === 'turntable') {
      if (!drag.current.active) spin.current += dt * 0.6; // keeps turning
    } else if (selected && !drag.current.active) {
      const nearestFront = Math.round(spin.current / TWO_PI) * TWO_PI;
      spin.current = THREE.MathUtils.damp(spin.current, nearestFront, 2.5, dt);
    }
    const targetRotY =
      mode === 'turntable' || selected ? spin.current : placement.restRot;

    if (!initialised.current) {
      g.position.set(targetPos[0], targetPos[1], targetPos[2]);
      g.rotation.y = targetRotY;
      g.scale.setScalar(targetScale);
      initialised.current = true;
      return;
    }

    g.position.x = THREE.MathUtils.damp(g.position.x, targetPos[0], 5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetPos[1], 5, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, targetPos[2], 5, dt);
    g.rotation.y =
      mode === 'turntable'
        ? spin.current
        : THREE.MathUtils.damp(g.rotation.y, targetRotY, 5, dt);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, targetScale, 5, dt));
  });

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        if (!selected) onSelect();
      }}
      onPointerDown={(e) => {
        if (!selected) return;
        e.stopPropagation();
        drag.current = { active: true, x: e.clientX };
        e.target.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        spin.current += (e.clientX - drag.current.x) * 0.012;
        drag.current.x = e.clientX;
      }}
      onPointerUp={(e) => {
        drag.current.active = false;
        e.target.releasePointerCapture?.(e.pointerId);
      }}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <group scale={fit.scale} position={fit.position}>
        <primitive object={garment} />
      </group>
    </group>
  );
}

function Viewer({ displayStyle, targetHeight, items, selectedId, onSelect }) {
  const kind = VIEWS[displayStyle] ? displayStyle : 'rack';
  const view = VIEWS[kind];
  const count = items.length;
  // A turntable shows one product at a time.
  const shown = kind === 'turntable' ? items.filter((item) => item.id === selectedId) : items;

  return (
    <Canvas key={kind} dpr={[1, 1.75]} camera={{ position: view.camera, fov: 42 }}>
      <color attach="background" args={['#18212d']} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 6, 4]} intensity={2.5} />
      <directionalLight position={[-4, 3, -3]} intensity={1} />

      <Suspense fallback={null}>
        {kind === 'rack' && <Rack count={count} />}
        {kind === 'rack' &&
          items.map((item, i) => (
            <Hanger key={`hanger-${item.id}`} x={rackX(i, count)} />
          ))}
        {kind === 'shelf' && <Shelf count={count} />}
        {kind === 'turntable' && <Platform />}

        {shown.map((item, i) => (
          <Garment
            key={item.id}
            url={item.model_url}
            x={rackX(i, kind === 'turntable' ? 1 : count)}
            selected={kind === 'turntable' ? true : item.id === selectedId}
            onSelect={() => onSelect(item.id)}
            mode={view.mode}
            targetHeight={targetHeight}
          />
        ))}
      </Suspense>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#293442" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={14} blur={2} />

      <OrbitControls
        target={view.target}
        enablePan={false}
        enableRotate={false}
        minDistance={3}
        maxDistance={11}
      />
    </Canvas>
  );
}

const TOKEN_KEY = 'thread3d-token';

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/* Combines a guest cart with a saved cart, keeping the larger quantity of each item. */
function mergeCarts(local, serverItems) {
  const merged = new Map();
  local.forEach((e) => merged.set(e.variantId, e.qty));
  serverItems.forEach((e) => {
    merged.set(e.variant_id, Math.max(merged.get(e.variant_id) || 0, e.qty));
  });
  return [...merged].map(([variantId, qty]) => ({ variantId, qty }));
}

/* Talks to the Laravel backend and turns error replies into readable messages. */
async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const first = data.errors ? Object.values(data.errors)[0][0] : data.message;
    const error = new Error(first || `Something went wrong (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function App() {
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [cart, setCart] = useState(loadCart);
  const [notice, setNotice] = useState('');
  const { active: loading3d, progress: progress3d } = useProgress();
  const [currencies, setCurrencies] = useState([]);
  const [currencyCode, setCurrencyCode] = useState(loadCurrencyCode);
  const [token, setToken] = useState(loadToken);
  const [customer, setCustomer] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [cartReady, setCartReady] = useState(false);

  // Load the store from the Laravel backend.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/sections`)
      .then((response) => {
        if (!response.ok) throw new Error(`Server answered ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSections(data);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(String(error.message || error));
        setStatus('error');
      });
    fetch(`${API_URL}/api/currencies`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setCurrencies(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // If a login token was saved, check it is still valid and load the customer.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    apiRequest('/api/customer/me', { token })
      .then((data) => {
        if (!cancelled) setCustomer(data.customer);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 401) {
          setToken('');
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            // ignore
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // After signing in: load the wishlist and merge the saved cart with the guest cart.
  useEffect(() => {
    if (!customer || !token) return undefined;
    let cancelled = false;
    Promise.all([
      apiRequest('/api/customer/wishlist', { token }),
      apiRequest('/api/customer/cart', { token }),
    ])
      .then(([wishlistData, cartData]) => {
        if (cancelled) return;
        setWishlist(wishlistData.product_ids);
        setCart((local) => mergeCarts(local, cartData.items));
        setCartReady(true);
      })
      .catch(() => {
        // the store still works without the saved data
      });
    return () => {
      cancelled = true;
    };
  }, [customer, token]);

  // While signed in, keep the saved cart up to date (after a short pause).
  useEffect(() => {
    if (!customer || !token || !cartReady) return undefined;
    const timer = setTimeout(() => {
      apiRequest('/api/customer/cart', {
        method: 'PUT',
        token,
        body: { items: cart.map((e) => ({ variant_id: e.variantId, qty: e.qty })) },
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [cart, customer, token, cartReady]);

  // Keep the cart across page reloads.
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage unavailable (private mode): the cart just won't persist
    }
  }, [cart]);

  // Hide the little message after a moment.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const section = sections[sectionIndex];
  const products = section ? section.products : [];
  const selected = products.find((p) => p.id === selectedId) ?? products[0];
  const rackItems = products.filter((p) => p.model_url);

  // Choice of size/colour for the selected product.
  const variants = selected ? selected.variants : [];
  const variant =
    variants.find((v) => v.id === variantId) ??
    variants.find((v) => v.stock > 0) ??
    variants[0];

  // Look up any variant by id, using live data from the backend.
  const variantIndex = useMemo(() => {
    const map = new Map();
    sections.forEach((s) =>
      s.products.forEach((p) =>
        p.variants.forEach((v) => map.set(v.id, { variant: v, product: p }))
      )
    );
    return map;
  }, [sections]);

  // Products the customer saved, with where to find them.
  const savedProducts = useMemo(
    () =>
      sections.flatMap((s, sectionIdx) =>
        s.products
          .filter((p) => wishlist.includes(p.id))
          .map((p) => ({ product: p, sectionIdx }))
      ),
    [sections, wishlist]
  );

  // Cart lines with live names, prices and stock. Anything removed or sold out drops away.
  const cartLines = useMemo(
    () =>
      cart
        .map((entry) => {
          const found = variantIndex.get(entry.variantId);
          if (!found) return null;
          const qty = Math.min(entry.qty, found.variant.stock);
          if (qty <= 0) return null;
          return { ...found, qty };
        })
        .filter(Boolean),
    [cart, variantIndex]
  );
  const cartCount = cartLines.reduce((n, line) => n + line.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.variant.price * line.qty, 0);

  // Prices in the database are in the base currency. Convert for display.
  const currency =
    currencies.find((c) => c.code === currencyCode) ??
    currencies.find((c) => c.is_base) ??
    null;
  const formatPrice = (baseAmount) =>
    formatMoney(baseAmount * (currency ? currency.rate : 1), currency ? currency.code : 'NGN');

  const chooseCurrency = (code) => {
    setCurrencyCode(code);
    try {
      localStorage.setItem(CURRENCY_KEY, code);
    } catch {
      // storage unavailable: the choice just won't be remembered
    }
  };

  const toggleWishlist = async (productId) => {
    if (!customer) {
      openAuth('login');
      setAuthError('Sign in to save items for later.');
      return;
    }
    const saved = wishlist.includes(productId);
    const before = wishlist;
    setWishlist(saved ? wishlist.filter((id) => id !== productId) : [...wishlist, productId]);
    try {
      await apiRequest(`/api/customer/wishlist/${productId}`, {
        method: saved ? 'DELETE' : 'POST',
        token,
      });
    } catch {
      setWishlist(before);
      setNotice('Could not save that. Please try again.');
    }
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthOpen(true);
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const body =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm;
      const data = await apiRequest(`/api/customer/${authMode}`, { method: 'POST', body });
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {
        // storage unavailable: they will need to sign in again next visit
      }
      setToken(data.token);
      setCustomer(data.customer);
      setAuthForm({ name: '', email: '', password: '' });
      setAuthOpen(false);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await apiRequest('/api/customer/logout', { method: 'POST', token });
    } catch {
      // even if the server is unreachable, sign out on this device
    }
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken('');
    setCustomer(null);
    setWishlist([]);
    setCartReady(false);
    setCart([]);
  };

  const addToCart = (v) => {
    const existing = cart.find((e) => e.variantId === v.id);
    const have = existing ? Math.min(existing.qty, v.stock) : 0;
    if (have >= v.stock) {
      setNotice('That is all we have in stock.');
      return;
    }
    setCart(
      existing
        ? cart.map((e) => (e.variantId === v.id ? { ...e, qty: have + 1 } : e))
        : [...cart, { variantId: v.id, qty: 1 }]
    );
    setNotice('Added to cart.');
  };

  const changeQty = (id, delta) => {
    const found = variantIndex.get(id);
    if (!found) return;
    setCart(
      cart.flatMap((e) => {
        if (e.variantId !== id) return [e];
        const next = Math.min(
          Math.max(Math.min(e.qty, found.variant.stock) + delta, 0),
          found.variant.stock
        );
        return next > 0 ? [{ ...e, qty: next }] : [];
      })
    );
  };

  const removeLine = (id) => setCart(cart.filter((e) => e.variantId !== id));

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand-mark">D</div>
        <div>
          <h1>THREAD<span>3D</span></h1>
          <p>Build your look. See it in 3D.</p>
        </div>
        <span className="prototype-label">BETA PROTOTYPE</span>
        {currencies.length > 1 && (
          <select
            className="currency-select"
            value={currency ? currency.code : ''}
            onChange={(e) => chooseCurrency(e.target.value)}
            aria-label="Currency"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        )}
        {customer ? (
          <button className="account-button" onClick={signOut}>
            {customer.name} · Sign out
          </button>
        ) : (
          <button className="account-button" onClick={() => openAuth('login')}>
            Sign in
          </button>
        )}
        <span className="cart-badge">Cart · {cartCount}</span>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">BROWSE THE STORE</p>

          {status === 'loading' && <p>Loading the store…</p>}
          {status === 'error' && (
            <p>
              Could not reach the store ({errorMessage}). Is the backend running
              with <code>php artisan serve</code>?
            </p>
          )}

          {status === 'ready' && sections.length === 0 && (
            <p>No sections yet. Add one in the admin at {API_URL}/admin.</p>
          )}

          {sections.length > 0 && (
            <section className="selection-section">
              <h2><span>01</span> Section</h2>
              <div className="options">
                {sections.map((item, index) => (
                  <button
                    key={item.id}
                    className={`option ${sectionIndex === index ? 'selected' : ''}`}
                    onClick={() => {
                      setSectionIndex(index);
                      setSelectedId(null);
                      setVariantId(null);
                    }}
                  >
                    <span className="option-name">{item.name}</span>
                    <span className="option-check">
                      {sectionIndex === index ? '✓' : '+'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {section && (
            <section className="selection-section">
              <h2><span>02</span> {section.name}</h2>
              <div className="options">
                {products.length === 0 && <p>No products in this section yet.</p>}
                {products.map((item) => (
                  <button
                    key={item.id}
                    className={`option ${selected && selected.id === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setVariantId(null);
                    }}
                  >
                    <span
                      className="swatch shirt-swatch"
                      style={{
                        backgroundColor: item.variants[0]?.color_hex || '#293442',
                      }}
                    />
                    <span className="option-name">
                      {item.name}
                      {!item.model_url && ' (no 3D model yet)'}
                    </span>
                    <span className="option-check">{formatPrice(item.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {selected && (
            <section className="selection-section">
              <h2><span>03</span> Size and colour</h2>
              {selected.description && (
                <p className="product-description">{selected.description}</p>
              )}
              {variants.length === 0 && <p>No sizes added yet.</p>}
              <div className="variant-grid">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    className={`variant-btn ${variant && variant.id === v.id ? 'selected' : ''}`}
                    disabled={v.stock <= 0}
                    onClick={() => setVariantId(v.id)}
                  >
                    <span
                      className="variant-dot"
                      style={{ backgroundColor: v.color_hex || '#293442' }}
                    />
                    {v.size || 'One size'}
                    {v.color_name ? ` · ${v.color_name}` : ''}
                    {v.stock <= 0 && ' (sold out)'}
                  </button>
                ))}
              </div>
              {variant && variant.stock > 0 && variant.stock <= 5 && (
                <p className="low-stock">Only {variant.stock} left</p>
              )}
              <button
                className="primary-button"
                disabled={!variant || variant.stock <= 0}
                onClick={() => addToCart(variant)}
              >
                {variant ? `Add to cart · ${formatPrice(variant.price)}` : 'Add to cart'}
              </button>
              <button className="heart-button" onClick={() => toggleWishlist(selected.id)}>
                {wishlist.includes(selected.id) ? '♥ Saved' : '♡ Save for later'}
              </button>
              {notice && <p className="notice">{notice}</p>}
            </section>
          )}

          {customer && savedProducts.length > 0 && (
            <section className="selection-section">
              <h2><span>♥</span> Saved for later</h2>
              <div className="options">
                {savedProducts.map(({ product, sectionIdx }) => (
                  <button
                    key={product.id}
                    className="option"
                    onClick={() => {
                      setSectionIndex(sectionIdx);
                      setSelectedId(product.id);
                      setVariantId(null);
                    }}
                  >
                    <span className="option-name">{product.name}</span>
                    <span className="option-check">{formatPrice(product.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="selection-summary">
            <p className="eyebrow">YOUR CART</p>
            {cartLines.length === 0 && <p>Your cart is empty.</p>}
            {cartLines.map((line) => (
              <div className="cart-line" key={line.variant.id}>
                <div className="cart-line-info">
                  <strong>{line.product.name}</strong>
                  <span>
                    {line.variant.size || 'One size'}
                    {line.variant.color_name ? ` · ${line.variant.color_name}` : ''}
                  </span>
                  <span>{formatPrice(line.variant.price)} each</span>
                </div>
                <div className="cart-line-actions">
                  <button onClick={() => changeQty(line.variant.id, -1)} aria-label="Fewer">−</button>
                  <span>{line.qty}</span>
                  <button onClick={() => changeQty(line.variant.id, 1)} aria-label="More">+</button>
                  <button onClick={() => removeLine(line.variant.id)} aria-label="Remove">×</button>
                </div>
              </div>
            ))}
            {cartLines.length > 0 && (
              <>
                <p className="cart-total">Total · {formatPrice(cartTotal)}</p>
                <button className="reset-button" disabled title="Checkout arrives in the next phase">
                  Checkout (coming soon)
                </button>
              </>
            )}
          </div>
        </aside>

        <section className="viewer-panel">
          <div className="viewer-heading">
            <div>
              <p className="eyebrow">LIVE PREVIEW</p>
              <h2>{section ? section.name : 'Your store'}</h2>
            </div>
            <span className="live-indicator">● LIVE</span>
          </div>

          <div className="canvas-container">
            <Viewer
              displayStyle={section ? section.display_style : 'rack'}
              targetHeight={section && section.target_height ? section.target_height : 1.1}
              items={rackItems}
              selectedId={selected ? selected.id : null}
              onSelect={(id) => {
                setSelectedId(id);
                setVariantId(null);
              }}
            />
            {loading3d && (
              <div
                className="loading-overlay"
                style={
                  selected && selected.poster_url
                    ? { backgroundImage: `url(${selected.poster_url})` }
                    : undefined
                }
              >
                <span>Loading 3D… {Math.round(progress3d)}%</span>
              </div>
            )}
            <div className="canvas-hint">
              Click a product · Drag it to spin · Scroll to zoom
            </div>
          </div>

          <div className="viewer-footer">
            <div>
              <span className="footer-dot" />
              {status === 'ready' ? 'Connected to the store backend' : 'Connecting…'}
            </div>
            <span>Changes in the admin appear on refresh</span>
          </div>
        </section>
      </div>
      {authOpen && (
        <div className="auth-backdrop" onClick={() => setAuthOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{authMode === 'login' ? 'Sign in' : 'Create your account'}</h2>
            <form onSubmit={submitAuth}>
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Your name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password (at least 8 characters)"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                minLength={8}
                required
              />
              {authError && <p className="auth-error">{authError}</p>}
              <button className="primary-button" disabled={authBusy}>
                {authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button
              className="link-button"
              onClick={() => openAuth(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login'
                ? 'New here? Create an account'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}