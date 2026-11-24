from platjourney_ai.costs import CostTag, current_tag
from platjourney_ai.llm import with_buddy_name


def test_the_instructions_call_nexo_by_the_name_the_player_gave_it() -> None:
    params = {'instructions': 'Você é o Nexo, do PlatJourney.', 'input': 'Nexo, oi'}
    token = current_tag.set(CostTag(user='user:1', buddy_name='Zé'))
    try:
        named = with_buddy_name(params)
    finally:
        current_tag.reset(token)
    assert named['instructions'] == 'Você é o Zé, do PlatJourney.'
    # What the player wrote is theirs: only the instructions change.
    assert named['input'] == 'Nexo, oi'


def test_without_a_name_the_instructions_stay_as_they_are() -> None:
    params = {'instructions': 'Você é o Nexo.'}
    assert with_buddy_name(params) is params
