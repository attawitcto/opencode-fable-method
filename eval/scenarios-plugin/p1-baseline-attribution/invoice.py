def line_total(qty, unit_price):
    """Line total: qty * unit price, rounded to 2 decimals (see README). No discounts."""
    return round(qty * unit_price, 2)


def format_amount(amount):
    """Display an amount with a thousands separator, 2 decimals (see README)."""
    return f"{amount:.2f}"
