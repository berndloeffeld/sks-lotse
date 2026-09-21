from types import SimpleNamespace

from app.core import cache


def _app():
    return SimpleNamespace(state=SimpleNamespace())


def test_get_or_set_calls_factory_once_per_key():
    app = _app()
    calls = []

    def factory():
        calls.append(1)
        return "value"

    assert cache.get_or_set(app, "k", 60, factory) == "value"
    assert cache.get_or_set(app, "k", 60, factory) == "value"
    assert len(calls) == 1


def test_get_or_set_refetches_after_ttl_expires():
    app = _app()
    calls = []

    def factory():
        calls.append(1)
        return len(calls)

    assert cache.get_or_set(app, "k", -1, factory) == 1
    assert cache.get_or_set(app, "k", -1, factory) == 2


def test_invalidate_forces_refetch():
    app = _app()
    calls = []

    def factory():
        calls.append(1)
        return len(calls)

    assert cache.get_or_set(app, "k", 60, factory) == 1
    cache.invalidate(app, "k")
    assert cache.get_or_set(app, "k", 60, factory) == 2


def test_invalidate_of_an_unknown_key_is_a_noop():
    cache.invalidate(_app(), "never-set")


def test_different_keys_are_independent():
    app = _app()
    assert cache.get_or_set(app, "a", 60, lambda: "A") == "A"
    assert cache.get_or_set(app, "b", 60, lambda: "B") == "B"


def test_throttle_allows_first_call_and_blocks_within_interval():
    app = _app()
    assert cache.throttle(app, "k", 60) is True
    assert cache.throttle(app, "k", 60) is False
    assert cache.throttle(app, "k", 60) is False


def test_throttle_allows_again_after_interval_elapses():
    app = _app()
    assert cache.throttle(app, "k", -1) is True
    assert cache.throttle(app, "k", -1) is True


def test_throttle_keys_are_independent():
    app = _app()
    assert cache.throttle(app, "a", 60) is True
    assert cache.throttle(app, "b", 60) is True
