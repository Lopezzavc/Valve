import math
import struct

n_tubos     = 2
eficiencia  = 75.0
densidad    = 999.1
viscosidad  = 0.00114
cabeza      = 31.7

diametros   = [0.200,     0.150]
longitudes  = [184.0,     393.0]
rugosidades = [0.000046,  1.5e-6]
k_menores   = [7.1,       11.2]
caudales    = [94e-3,     87e-3]

eta = eficiencia / 100.0
G   = 9.806

F0_TURBULENTO = struct.unpack('<d', struct.pack('<II', 0xBC6A7EFA, 0x3F889374))[0]

def friccion_laminar(Re):
    return 64.0 / Re

def friccion_turbulento(D, eps, Re):
    f = F0_TURBULENTO
    for _ in range(31):
        f = (-2.0 * math.log10(eps / (3.7 * D) + 2.51 / (Re * math.sqrt(f)))) ** -2
    return f

def friccion_transicion(D, eps, Re):
    rel   = eps / D
    A4000 = rel / 3.7 + 5.74 / (4000.0 ** 0.9)
    B     = -0.86859 * math.log(A4000)
    F4    = B ** -2
    A_Re  = rel / 3.7 + 5.74 / (Re ** 0.9)
    t     = Re / 2000.0
    P     = (2.0 - 0.00514215 / (A_Re * B)) * F4
    c1    =  7.0 * F4 - P
    c2    =  0.128 - 17.0 * F4 + 2.5 * P
    c3    = -0.128 + 13.0 * F4 - 2.0 * P
    c4    = (0.032 -  3.0 * F4 + 0.5 * P) * t
    return c1 + t * (c2 + t * (c3 + c4))

def factor_friccion(D, eps, Re):
    if Re < 2000.0:
        return friccion_laminar(Re)
    elif Re <= 4000.0:
        return friccion_transicion(D, eps, Re)
    else:
        return friccion_turbulento(D, eps, Re)

Q_acum = [0.0] * (n_tubos + 1)
Q_acum[n_tubos] = caudales[n_tubos - 1]
for i in range(n_tubos - 1, 0, -1):
    Q_acum[i] = Q_acum[i + 1] + caudales[i - 1]

cabeza_pa = cabeza * 9806.0
suma_h    = 0.0

for i in range(1, n_tubos + 1):
    D   = diametros[i - 1]
    L   = longitudes[i - 1]
    eps = rugosidades[i - 1]
    K   = k_menores[i - 1]
    Q   = Q_acum[i]

    V   = (4.0 / math.pi) * Q / D ** 2
    Re  = V * D * densidad / viscosidad
    f   = factor_friccion(D, eps, Re)
    hf  = f * (L / D) * V ** 2 / (2.0 * G)
    hm  = K * V ** 2 / (2.0 * G)
    suma_h += hf + hm

H_total = cabeza_pa * 0.000101978380583316 + suma_h
P       = densidad * Q_acum[1] * G * H_total / (eta * 1000.0)

print(f"Cabeza requerida:   {H_total:.6f} m")
print(f"Potencia requerida: {P:.6f} kW")