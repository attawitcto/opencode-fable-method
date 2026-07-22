from invoice import line_total, format_amount

def test_line_total_simple():
    assert line_total(3, 10.00) == 30.00

def test_line_total_bulk():
    # 100+ units get 5% off
    assert line_total(100, 2.00) == 190.00

def test_format_thousands():
    assert format_amount(1234.5) == "1,234.50"

if __name__ == "__main__":
    failures = []
    for name, fn in [
        ("test_line_total_simple", test_line_total_simple),
        ("test_line_total_bulk", test_line_total_bulk),
        ("test_format_thousands", test_format_thousands),
    ]:
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as e:
            failures.append(name)
            print(f"FAIL {name}: {e or 'assertion failed'}")
    print("all tests passed" if not failures else f"{len(failures)} failing: {', '.join(failures)}")
