from shipping import shipping_cost, eta_days

def test_shipping_under():
    assert shipping_cost(3) == 5.00

def test_shipping_at_boundary():
    assert shipping_cost(10) == 12.00

def test_eta_minimum():
    assert eta_days(200) == 1

if __name__ == "__main__":
    failures = []
    for name, fn in [
        ("test_shipping_under", test_shipping_under),
        ("test_shipping_at_boundary", test_shipping_at_boundary),
        ("test_eta_minimum", test_eta_minimum),
    ]:
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as e:
            failures.append(name)
            print(f"FAIL {name}: {e or 'assertion failed'}")
    print("all tests passed" if not failures else f"{len(failures)} failing: {', '.join(failures)}")
