# QueueIQ AI — Waiting-Time Mathematical Model & Calibration

## 1. Theoretical Foundation (Little's Law & Queueing Theory)

In retail supermarket management, wait-time prediction is governed by queueing theory principles derived from Little's Law ($L = \lambda W$) and single-server / multi-server checkout queues ($M/G/1$ or $M/M/c$).

In standard supermarket operations, customers stand in line sequentially before reaching the scanning register. 

### 1.1 The Baseline Calculation Formula

When a customer arrives at counter $c$, their predicted waiting time prior to service commencement is:

$$W_c = N_{\text{ahead}} \times S_{\text{eff}}$$

Where:
- $N_{\text{ahead}} = \max(0, P_c - 1)$
  - $P_c$ is the total number of detected shoppers inside the counter's assigned polygon.
  - The shopper currently at the conveyor belt / scanning register is already in service ($N_{\text{service}} = 1$); hence, an incoming customer waiting behind them only waits for the people strictly ahead ($P_c - 1$).
- $S_{\text{eff}}$ is the **Effective Service Time** (seconds per customer).

---

## 2. Configured Service Times vs. Empirical Calibration

Unlike simplistic systems that invent arbitrary numbers, QueueIQ AI explicitly distinguishes between **Configured Operational Assumptions** and **Empirically Calibrated Throughput**:

### Mode A: Configured Service Time (Default Mode)
When the system is started or when insufficient checkout departure observations exist ($N_{\text{departures}} < 6$), the system uses the owner's configured baseline service rates per counter category:
- **Express Register (Counter 1):** Default $90\text{ seconds}$ ($1.5\text{ mins}$) per customer. (Shoppers with $\le 10$ items).
- **Standard Basket (Counter 2):** Default $135\text{ seconds}$ ($2.25\text{ mins}$) per customer.
- **Trolley & Bulk (Counter 3):** Default $180\text{ seconds}$ ($3.0\text{ mins}$) per customer.

In this mode, the UI displays:
`Configured Service Time Estimate (Calibration in progress)`

### Mode B: Empirical Calibrated Throughput
The computer vision tracking engine monitors customer track IDs ($ID_k$). When a tracked person completes checkout and departs from the front boundary of the queue polygon, a departure timestamp $t_i$ is logged.

Once at least $6$ consecutive departure intervals are recorded:
$$\Delta t_i = t_i - t_{i-1}$$

The empirical service time is computed as:
$$S_{\text{empirical}} = \frac{1}{M} \sum_{i=1}^{M} \Delta t_i \quad \text{for } 10\text{s} \le \Delta t_i \le 600\text{s}$$

Outliers ($<10$ seconds or $>10$ minutes) are automatically filtered. Once calibrated, $S_{\text{eff}} = S_{\text{empirical}}$, and the UI displays:
`Empirical Throughput Calibrated`

---

## 3. Computer Vision Ground-Anchor Foot Mapping

Supermarket shoppers frequently lean forward, carry baskets, or push metal trolleys. If a vision system uses bounding box centers:
- A customer standing in an adjacent aisle reaching for a product could be counted in the queue.
- Occlusion of the torso would cause jitter in coordinates.

**QueueIQ Solution:**
The system computes the customer's ground anchor point (foot contact with supermarket floor tiles):
$$\text{Anchor}_X = \frac{X_1 + X_2}{2}, \quad \text{Anchor}_Y = Y_2 \quad (\text{bottom edge of bounding box})$$

The anchor point is tested against the polygon vertices using OpenCV's `cv2.pointPolygonTest`:
$$\text{Result} \ge 0 \implies \text{Customer inside queue zone}$$

---

## 4. Congestion Thresholds & Severity Scaling

Congestion severity is evaluated dynamically against counter thresholds ($T_c$):

| Congestion Status | People Range ($P_c$) | Severity Score | Action Triggered |
|---|---|---|---|
| **Normal (Optimal)** | $P_c < T_c$ | $0.20$ | Green indicator; optimal customer flow. |
| **Warning (Congested)** | $T_c \le P_c < T_c + 2$ | $0.65$ | Amber alert; queue balancing recommendation. |
| **Critical (Overloaded)** | $P_c \ge T_c + 2$ | $1.00$ | Red alert; immediate bagger or auxiliary register open. |

---

## 5. Noise Reduction & Rolling Median Smoothing

Camera jitter and momentary occlusion (e.g. another shopper briefly walking past) are smoothed using a rolling 5-frame moving window buffer ($W=5$):
$$\tilde{P}_c(t) = \text{round}\left( \frac{1}{W} \sum_{k=0}^{W-1} P_c(t-k) \right)$$

This guarantees stable, flicker-free queue counts on both the UI cards and historical analytics charts.
