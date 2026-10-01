from platjourney_ai.costs import Usage, cost_usd
from platjourney_ai.schemas import GameContext, shown_progress


def test_cost_counts_cached_tokens_at_their_price() -> None:
    # 1M fresh input at $5, 1M cached at $0.50, 1M output at $30, 2 searches at $0.01.
    usage = Usage(input=2_000_000, cached=1_000_000, output=1_000_000, searches=2)
    assert cost_usd('gpt-5.5', usage) == 5 + 0.5 + 30 + 0.02


def test_dated_snapshot_costs_the_same_as_its_alias() -> None:
    assert cost_usd('gpt-5.5-2026-08-01', Usage(output=1_000_000)) == 30


def test_the_smaller_models_have_their_own_price() -> None:
    usage = Usage(input=1_000_000, output=1_000_000)
    assert cost_usd('gpt-5.6-luna', usage) == 0.2 + 1.2
    assert cost_usd('gpt-5.6-terra', usage) == 2 + 12


def test_unknown_model_costs_zero() -> None:
    assert cost_usd('mystery', Usage(input=1_000_000)) == 0


def context(include_dlc: bool) -> GameContext:
    return GameContext.model_validate(
        {
            'game': {'id': 'game:1', 'name': 'Days Gone'},
            'title': {
                'name': 'Days Gone',
                'platform': 'PS4',
                'progress': 20,
                'earned': 12,
                'total': 61,
            },
            'trophies': [],
            'groups': {'base': {'earned': 12, 'total': 46}, 'dlc': {'earned': 0, 'total': 15}},
            'includeDlcProgress': include_dlc,
        }
    )


def test_progress_counts_the_base_game_by_default() -> None:
    shown = shown_progress(context(False))
    assert (shown.earned, shown.total, shown.progress, shown.label) == (12, 46, 26, ' do jogo base')


def test_progress_counts_dlc_when_the_player_asks() -> None:
    shown = shown_progress(context(True))
    assert (shown.earned, shown.total, shown.label) == (12, 61, ' com DLC')
