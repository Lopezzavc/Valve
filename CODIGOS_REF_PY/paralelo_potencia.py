import math

# ─────────────────────────────────────────────
# CONSTANTES (extraídas del binario)
# ─────────────────────────────────────────────
G           = 9.806          # m/s²  (tbyte ds:[4FBB3A] y ds:[47C1A4])
DOS_G       = 19.612         # 2·g   (ds:[47C1A4] y ds:[47E3D0])
PI          = math.pi        # ds:[47E368]
CONV_LS     = 1000.0         # factor L/s (ds:[4FC3F4])
TOL_CONV    = 1e-7           # tolerancia convergencia interna (ds:[47E3DC])
RE_LAM      = 2000.0         # límite laminar    (ds:[46E384])
RE_TURB     = 4000.0         # límite turbulento (ds:[46E388])


# ─────────────────────────────────────────────
# 1. FACTOR DE FRICCIÓN  (sub_0046E254)
# ─────────────────────────────────────────────
def _f_laminar(Re):
    """Re < 2000 → Hagen-Poiseuille  (sub_0046E3AC)"""
    return 64.0 / Re


def _f_transicion(Re, eps, D):
    """2000 ≤ Re ≤ 4000 → interpolación lineal entre laminar y turbulento
    (sub_0046E518)"""
    f_lam  = _f_laminar(RE_LAM)
    f_turb = _f_colebrook(RE_TURB, eps, D)
    t = (Re - RE_LAM) / (RE_TURB - RE_LAM)
    return f_lam + t * (f_turb - f_lam)


def _f_colebrook(Re, eps, D):
    """Re > 4000 → Colebrook-White iterativo  (sub_0046E464)
    1/√f = -2·log10(ε/(3.7·D) + 2.51/(Re·√f))
    """
    # Estimación inicial: Swamee-Jain
    f = 0.25 / (math.log10(eps / (3.7 * D) + 5.74 / Re**0.9))**2
    for _ in range(100):
        f_new = (-2.0 * math.log10(eps / (3.7 * D) + 2.51 / (Re * math.sqrt(f))))**(-2)
        if abs(f_new - f) < 1e-12:
            break
        f = f_new
    return f_new


def factor_friccion(Re, eps, D):
    """Dispatcher según régimen  — replica sub_0046E254"""
    if Re < RE_LAM:
        return _f_laminar(Re)
    elif Re <= RE_TURB:
        return _f_transicion(Re, eps, D)
    else:
        return _f_colebrook(Re, eps, D)


# ─────────────────────────────────────────────
# 2. PÉRDIDA EN UNA TUBERÍA (Darcy-Weisbach)
# ─────────────────────────────────────────────
def perdida_tuberia(Q, D, L, eps, K, nu):
    """
    Calcula hf = (f·L/D + K) · v²/(2g)
    donde v = Q/A,  A = π·D²/4
    Retorna (hf, f, Re)
    """
    A  = PI * D**2 / 4.0
    v  = Q / A
    Re = v * D / nu          # = 4Q/(π·D·ν)
    if Re < 1e-12:
        return 0.0, 0.0, 0.0
    f  = factor_friccion(Re, eps, D)
    hf = (f * L / D + K) * v**2 / DOS_G
    return hf, f, Re


# ─────────────────────────────────────────────
# 3. ESTIMACIÓN INICIAL DE Q[1]  (sub_0047C1B0)
# ─────────────────────────────────────────────
def estimar_q_inicial(Q_total, tuberias):
    """
    Distribuye Q_total proporcional a D_i² / √L_i
    (pesos observados en el bucle de 0047C1B0)
    """
    pesos = [D**2 / math.sqrt(L) for (D, L, eps, K) in tuberias]
    suma  = sum(pesos)
    return [Q_total * p / suma for p in pesos]


# ─────────────────────────────────────────────
# 4. RESOLVER Q_i DADO hf  (sub_0047E17C)
# ─────────────────────────────────────────────
def resolver_qi_dado_hf(hf_objetivo, D, L, eps, K, nu):
    """
    Encuentra Q_i tal que hf(Q_i) == hf_objetivo.
    Bisección con control de signo — replica sub_0047E17C.
    Retorna Q_i o lanza ValueError.
    """
    A = PI * D**2 / 4.0

    def residuo(Q):
        hf, _, _ = perdida_tuberia(Q, D, L, eps, K, nu)
        return hf - hf_objetivo

    # Acotar el intervalo
    Q_lo, Q_hi = 0.0, hf_objetivo  # hf ≥ Q²·cte → Q ≤ √(hf·2g·A²/1)
    # Aumentar Q_hi hasta que residuo cambie de signo
    while residuo(Q_hi) < 0:
        Q_hi *= 2.0
        if Q_hi > 1e6:
            raise ValueError("No se pudo acotar Q para bisección")

    # Bisección  (tolerancia interna = 1e-7, igual que ds:[47E3DC])
    for _ in range(200):
        Q_mid = (Q_lo + Q_hi) / 2.0
        r = residuo(Q_mid)
        if abs(r) < TOL_CONV:
            return Q_mid
        if r < 0:
            Q_lo = Q_mid
        else:
            Q_hi = Q_mid

    return (Q_lo + Q_hi) / 2.0


# ─────────────────────────────────────────────
# 5. SOLVER PRINCIPAL  (sub_0047BF88)
# ─────────────────────────────────────────────
def solver_paralelo(Q_total, H_m, tuberias, nu, tol=1e-7, max_iter=500):
    """
    Algoritmo de escalamiento proporcional:
      1. Q[0] como pivote → calcula hf
      2. Para i≥1 resuelve Q_i(hf)
      3. Escala Q[0] = Q[0] · Q_total / ΣQ_i
      4. Repite hasta |Q_total − ΣQ_i| < tol

    Retorna lista de caudales [Q_1, Q_2, ..., Q_N] en m³/s
    """
    N  = len(tuberias)
    Qs = estimar_q_inicial(Q_total, tuberias)

    for iteracion in range(1, max_iter + 1):
        D0, L0, eps0, K0 = tuberias[0]
        hf, _, _ = perdida_tuberia(Qs[0], D0, L0, eps0, K0, nu)

        # Resolver caudales de las demás tuberías dado hf
        for i in range(1, N):
            Di, Li, epsi, Ki = tuberias[i]
            Qs[i] = resolver_qi_dado_hf(hf, Di, Li, epsi, Ki, nu)

        Q_suma = sum(Qs)

        # Criterio de convergencia  (ds:[ebx+28] en sub_0047BF88)
        if abs(Q_total - Q_suma) < tol:
            break

        # Escalar Q[0]  (línea 0047C14B-0047C159)
        Qs[0] = Qs[0] * Q_total / Q_suma

    return Qs, iteracion


# ─────────────────────────────────────────────
# 6. FUNCIÓN PRINCIPAL  (btnCalcularClick)
# ─────────────────────────────────────────────
def calcular(H_presion, rho, nu, Q_total, tuberias, tol=1e-7):
    """
    Parámetros
    ----------
    H_presion : float   Cabeza en unidades de presión (Pa o kPa según entrada)
    rho       : float   Densidad del fluido [kg/m³]
    nu        : float   Viscosidad cinemática [m²/s]
    Q_total   : float   Caudal total [m³/s]
    tuberias  : list    [(D, L, eps, K), ...]  en metros
    tol       : float   Tolerancia de convergencia

    Retorna
    -------
    dict con Q_i [L/s], H_m [m], P [kW], iteraciones
    """
    # Validaciones (sub_004FB5FC)
    assert H_presion > 0,  "Error: La cabeza total debe ser mayor a 0"
    assert rho       > 0,  "Error: La densidad debe ser mayor a 0"
    assert nu        > 0,  "Error: La viscosidad debe ser mayor a 0"
    assert Q_total   > 0,  "Error: El caudal total debe ser mayor a 0"
    for idx, (D, L, eps, K) in enumerate(tuberias, 1):
        assert D   > 0,  f"Error tubería {idx}: El diámetro debe ser mayor a 0"
        assert L   > 0,  f"Error tubería {idx}: La longitud debe ser mayor a 0"
        assert eps >= 0, f"Error tubería {idx}: La rugosidad debe ser ≥ 0"
        assert K   >= 0, f"Error tubería {idx}: El coef. de pérdidas menores debe ser ≥ 0"

    # Conversión cabeza → metros  (0047BBA: H_m = H / (rho·g))
    H_m = H_presion / (rho * G)

    # Solver (sub_0047BF88)
    Qs, iters = solver_paralelo(Q_total, H_m, tuberias, nu, tol)

    # Potencia hidráulica (sub_004FC1A0)
    # P [kW] = rho·g·Q_total·H_m / 1000
    P_kW = rho * G * Q_total * H_m / 1000.0

    return {
        "H_metros"     : H_m,
        "Q_por_tuberia": [q * CONV_LS for q in Qs],   # L/s
        "Q_total_check": sum(Qs) * CONV_LS,            # debe ≈ Q_total·1000
        "Potencia_kW"  : P_kW,
        "iteraciones"  : iters,
    }


# ─────────────────────────────────────────────
# DEMO — ejecutar directamente en Colab
# ─────────────────────────────────────────────
if __name__ == "__main__":

    # ── Datos de entrada ──────────────────────
    H_presion = 875000.0    # Pa  (cabeza en presión)
    rho       = 860.0     # kg/m³  (agua)
    nu        = 8.360465116279E-6       # m²/s   (agua a 20°C)
    Q_total   = 460e-3       # m³/s   (caudal total)

    # (Diámetro[m], Longitud[m], Rugosidad[m], Coef_menores)
    tuberias = [
        (0.450, 278.0, 0.046e-3, 7.7),   # tubería 1
        (0.300, 312.0, 0.046e-3, 9.4),   # tubería 2
        (0.300, 312.0, 0.046e-3, 9.4),   # tubería 3
    ]

    # ── Cálculo ───────────────────────────────
    res = calcular(H_presion, rho, nu, Q_total, tuberias)

    # ── Resultados (replica sub_004FC1A0) ─────
    print("=" * 50)
    print("   POTENCIA EN TUBERÍAS EN PARALELO")
    print("=" * 50)
    print(f"  Cabeza hidráulica : {res['H_metros']:.4f} m")
    print(f"  Convergencia en   : {res['iteraciones']} iteraciones")
    print()
    print("  ID  | Caudal (L/s)")
    print("  ----|-------------")
    for i, q in enumerate(res["Q_por_tuberia"], 1):
        print(f"   {i}  |  {q:.4f}")
    print()
    print(f"  Suma caudales : {res['Q_total_check']:.4f} L/s  "
          f"(entrada: {Q_total*1000:.4f} L/s)")
    print(f"  Potencia      : {res['Potencia_kW']:.4f} kW")
    print("=" * 50)