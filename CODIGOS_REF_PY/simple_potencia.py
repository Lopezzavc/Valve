import math

# ---------------------------------------------------------------------------
# CONSTANTES  (extraídas del binario)
# ---------------------------------------------------------------------------
G          = 9.806                      # m/s²       (literal 47DC04)
DOS_G      = 2.0 * G                   # 19.612      (literal 47DBF8)
PI         = math.pi                   # 3.14159…    (literal 47DBE8)
TOL        = 1e-7                      # tolerancia  (literal 47E3DC)
MAX_ITER   = 1000
PA_TO_MH2O = 0.000101978380583316      # Pa → mH₂O  (literal 47DBDC)
RE_MIN     = 2000                      # límite Reynolds (literal 4BF6B0)


# ---------------------------------------------------------------------------
# FUNCIÓN: factor de fricción Darcy-Weisbach  (sub_0047DC80)
# Ecuación implícita de Colebrook-White resuelta iterativamente.
# ---------------------------------------------------------------------------
def factor_friccion(Re, eps, D):
    """
    Retorna f (Darcy-Weisbach) o None si hay error numérico.
    Flujo laminar (Re<2000): f = 64/Re
    """
    if Re <= 0 or D <= 0:
        return None
    if Re < RE_MIN:
        return 64.0 / Re

    eps_D = eps / D
    # Aproximación inicial Swamee-Jain
    try:
        f = 0.25 / (math.log10(eps_D / 3.7 + 5.74 / Re ** 0.9)) ** 2
    except (ValueError, ZeroDivisionError):
        f = 0.02

    for _ in range(MAX_ITER):
        try:
            f_new = (-2.0 * math.log10(
                eps_D / 3.7 + 2.51 / (Re * math.sqrt(f))
            )) ** -2
        except (ValueError, ZeroDivisionError):
            return None
        if abs(f - f_new) < TOL:
            return f_new
        f = f_new
    return f


# ---------------------------------------------------------------------------
# FUNCIÓN PRINCIPAL  (sub_0047D9F0 + btnCalcularClick 004BF404)
# ---------------------------------------------------------------------------
def pot_simples(H1, Z1, H2, Z2, eficiencia,
                diametro, rugosidad, longitud, coef_menores,
                densidad, viscosidad, caudal,
                verbose=True):
    """
    Potencia en tubería simple — equivalente a Prog03PotSimples.

    Parámetros
    ----------
    H1, H2       : Presiones manométricas puntos 1 y 2 [Pa]
    Z1, Z2       : Cotas puntos 1 y 2                  [m]
    eficiencia   : Eficiencia η                         [%]
    diametro     : Diámetro D                           [m]
    rugosidad    : Rugosidad absoluta ε                 [m]
    longitud     : Longitud L                           [m]
    coef_menores : Coeficiente K pérdidas menores       [-]
    densidad     : Densidad ρ                           [kg/m³]
    viscosidad   : Viscosidad dinámica μ                [Pa·s]
    caudal       : Caudal Q                             [m³/s]
    verbose      : Imprime resultados

    Retorna  dict  o  None si hay error.
    """

    # -----------------------------------------------------------------------
    # CONVERSIÓN Pa → mH₂O  (0047DA21-0047DA54)
    # -----------------------------------------------------------------------
    H1_m = H1 * PA_TO_MH2O
    H2_m = H2 * PA_TO_MH2O

    # -----------------------------------------------------------------------
    # VALIDACIONES  (sub_004BEB34)
    # -----------------------------------------------------------------------
    errores = []
    # (H1+Z1) debe ser < (H2+Z2) para necesitar bomba  (4BEE42)
    if (H1_m + Z1) >= (H2_m + Z2):
        errores.append(
            "La cabeza total en punto 2 (Z2+H2) debe ser mayor "
            "a la cabeza total en punto 1 (Z1+H1)"
        )
    if diametro <= 0:
        errores.append("El diámetro debe ser mayor a 0")
    if rugosidad <= 0:
        errores.append("La rugosidad debe ser mayor a 0")
    if longitud <= 0:
        errores.append("La longitud debe ser mayor a 0")
    if coef_menores < 0:
        errores.append("El coeficiente de pérdidas menores debe ser >= 0")
    if caudal <= 0:
        errores.append("El caudal debe ser mayor a 0")
    if not (0 < eficiencia <= 100):
        errores.append("La eficiencia debe estar entre 0 y 100 %")
    if densidad <= 0:
        errores.append("La densidad debe ser mayor a 0")
    if viscosidad <= 0:
        errores.append("La viscosidad debe ser mayor a 0")

    if errores:
        print("❌ ERRORES DE VALIDACIÓN:")
        for e in errores:
            print(f"   • {e}")
        return None

    # -----------------------------------------------------------------------
    # CÁLCULO HIDRÁULICO  (sub_0047D9F0)
    # -----------------------------------------------------------------------
    nu = viscosidad / densidad                          # m²/s
    D  = diametro

    A  = PI * D ** 2 / 4.0                             # m²
    V  = caudal / A                                    # m/s   (0047DA82)
    Re = D * V / nu                                    # [-]   (0047DA96)

    f = factor_friccion(Re, rugosidad, D)              # sub_0047DC80
    if f is None:
        print("❌ ERROR: No se pudo calcular el factor de fricción.")
        return None

    # Darcy-Weisbach  (0047DAEC-0047DAFF)
    hf = f * (longitud / D) * V ** 2 / DOS_G          # m

    # Pérdidas menores  (0047DB02-0047DB2D)
    hm = coef_menores * V ** 2 / DOS_G                # m

    # Cabeza de bomba  (0047DB2E-0047DB43)
    Hb = (H2_m + Z2) + hf + hm - (H1_m + Z1)        # m

    if Hb <= 0:
        print("❌ ERROR: La potencia calculada es ≤ 0.")
        print("   Verifique que el punto 2 realmente requiere bombeo.")
        return None

    # Potencia  (0047DB44-0047DB62)
    # P = g · ρ · Q · Hb / (η/100)
    P_W  = G * densidad * caudal * Hb / (eficiencia / 100.0)
    P_kW = P_W / 1000.0                               # 4BE93E: fdiv 1000

    aviso_Re = Re < RE_MIN

    # -----------------------------------------------------------------------
    # RESULTADOS
    # -----------------------------------------------------------------------
    resultados = {
        "Hb_m"    : Hb,
        "P_kW"    : P_kW,
        "P_W"     : P_W,
        "Re"      : Re,
        "f"       : f,
        "hf_m"    : hf,
        "hm_m"    : hm,
        "V_ms"    : V,
        "H1_mH2O" : H1_m,
        "H2_mH2O" : H2_m,
        "aviso_Re": aviso_Re,
    }

    if verbose:
        _imprimir_resultados(resultados)

    return resultados


# ---------------------------------------------------------------------------
# IMPRESIÓN  (sub_004BE8F0 — orden de campos del formulario)
# ---------------------------------------------------------------------------
def _imprimir_resultados(r):
    sep = "=" * 58
    print(f"\n{sep}")
    print("   PROG03 — POTENCIA EN TUBERÍA SIMPLE (PotSimples)")
    print(sep)
    print(f"\n   Cabeza de bomba Hb      : {r['Hb_m']:.6f}  m")
    print(f"   Potencia requerida      : {r['P_kW']:.6f}  kW")
    print(f"   Número de Reynolds      : {r['Re']:.2f}")
    print(f"   Factor de fricción (f)  : {r['f']:.6f}")
    print(f"   Pérd. menores           : {r['hm_m']:.6f}  m")
    print(f"   Hf fricción             : {r['hf_m']:.6f}  m")
    print(f"   Velocidad               : {r['V_ms']:.6f}  m/s")
    if r['aviso_Re']:
        print("\n   ⚠️  Re < 2000 — flujo LAMINAR")
    print(sep + "\n")


# ---------------------------------------------------------------------------
# EJEMPLO DE USO
# ---------------------------------------------------------------------------
if __name__ == "__main__":

    resultado = pot_simples(
        H1           = 0.0,         # Pa  (presión manométrica punto 1)
        Z1           = 0.0,         # m   (cota punto 1)
        H2           = 0.0,         # Pa  (presión manométrica punto 2)
        Z2           = 16.0,        # m   (cota punto 2, 25 m más alto)
        eficiencia   = 100.0,        # %
        diametro     = 0.150,       # m   = 150 mm
        rugosidad    = 1.5e-6,      # m
        longitud     = 970.0,       # m
        coef_menores = 9.4,         # K adimensional
        densidad     = 999.1,      # kg/m³
        viscosidad   = 0.00114,      # Pa·s
        caudal       = 42e-3,       # m³/s = 20 L/s
    )