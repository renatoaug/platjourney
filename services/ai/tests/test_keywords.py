from platjourney_ai import keywords
from platjourney_ai.guidestore import Passage


def passage(position: int, content: str, heading: str = '') -> Passage:
    return Passage(
        source='Guide', url='https://a', heading=heading, content=content, position=position
    )


def test_words_drop_question_words_in_both_languages() -> None:
    assert keywords.words('Onde fica o vinil da Virginia?') == ['vinil', 'virginia']
    assert keywords.words('Where is the Virginia vinyl?') == ['virginia', 'vinyl']


def test_rank_puts_the_passage_with_the_rare_words_first() -> None:
    every = [
        passage(1, 'Go to the hospital and take the stairs.'),
        passage(2, 'The vinyl is in the record player.'),
        passage(3, 'Virginia vinyl: on the shelf by the window.'),
        passage(4, 'Nothing here.', heading='Chapter 4'),
    ]
    assert keywords.rank(every, 'where is the Virginia vinyl?') == [3, 2]
    assert keywords.rank(every, 'chapter 4') == [4]
    assert keywords.rank(every, 'onde?') == []
    assert keywords.rank([], 'vinyl') == []


def test_fuse_rewards_what_several_lists_agree_on_and_weighs_each_list() -> None:
    assert keywords.fuse([[1, 2, 3], [3, 1]], [1, 1]) == [1, 3, 2]
    assert keywords.fuse([[1, 2], [2]], [1, 1]) == [2, 1]
    assert keywords.fuse([[1, 2], [2]], [1, 0.01]) == [1, 2]
    assert keywords.fuse([[1, 2, 3]], [1], depth=2) == [1, 2]
