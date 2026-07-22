def shipping_cost(weight_kg):
    """5.00 under 10kg, 12.00 at 10kg and above (see README)."""
    if weight_kg > 10:
        return 12.00
    return 5.00


def eta_days(distance_km):
    """One whole day per 500km started, minimum 1 day (see README)."""
    return distance_km // 500
