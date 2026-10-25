from typing import Any

from platjourney_ai import chapters


def test_named_reads_the_chapter_from_headings_and_questions() -> None:
    assert chapters.named('TEXT GUIDE > Chapter 18') == {('chapter', 18)}
    assert chapters.named('Episode 3 Walkthrough > Chapter 1: Windy Nights') == {
        ('episode', 3),
        ('chapter', 1),
    }
    assert chapters.named('Chapter III: The Road') == {('chapter', 3)}
    assert chapters.named('Mission 09') == {('mission', 9)}
    assert chapters.named('Guía > CAPÍTULO 10') == {('chapter', 10)}
    assert chapters.named('onde fica a flor do capítulo 3?') == {('chapter', 3)}
    assert chapters.named('o que tem pra pegar no cap 2') == {('chapter', 2)}
    assert chapters.named('colecionáveis do capítulo dois') == {('chapter', 2)}
    assert chapters.named('fim do episódio quatro') == {('episode', 4)}


def test_named_leaves_out_ranges_destinations_and_other_numbers() -> None:
    assert chapters.named('Missable Trophies Planning > Chapter 1-6 Trophies') == set()
    assert chapters.named('capítulos 3 e 4') == set()
    assert chapters.named('Step 2: Chapter Select to Chapter 9') == set()
    assert chapters.named('volte depois do capítulo 5') == set()
    assert chapters.named('Phase Two | Reach Level 99') == set()
    assert chapters.named('How to act in a pinch') == set()
    assert chapters.named('ch iv') == set()


def test_in_terms_of_uses_the_only_unit_the_guide_has() -> None:
    asked = frozenset({('chapter', 3)})
    assert chapters.in_terms_of(asked, {'mission'}) == {('mission', 3)}
    assert chapters.in_terms_of(asked, {'chapter', 'mission'}) == asked
    assert chapters.in_terms_of(asked, {'episode', 'act'}) == asked
    assert chapters.in_terms_of(frozenset(), {'mission'}) == set()


def test_elsewhere_is_another_chapter_of_the_unit_asked() -> None:
    asked = frozenset({('chapter', 3)})
    assert chapters.elsewhere(frozenset({('chapter', 13)}), asked)
    assert not chapters.elsewhere(frozenset({('chapter', 3), ('episode', 2)}), asked)
    assert not chapters.elsewhere(frozenset({('episode', 2)}), asked)
    assert not chapters.elsewhere(frozenset(), asked)


class _T:
    def __init__(self, name: str, detail_en: str = '', earned: bool = False) -> None:
        self.name = name
        self.name_en = name
        self.detail = ''
        self.detail_en = detail_en
        self.earned = earned


GUIDE: dict[str, Any] = {
    'milestones': [
        {'after': None, 'tips': []},
        {'after': 'Ch1', 'tips': [{'kind': 'collectible', 'where': 'Subcapítulo O portão'}]},
        {'after': 'Ch2', 'tips': [{'kind': 'collectible', 'where': 'Capítulo 3, Estação'}]},
        {'after': 'Mark', 'tips': []},
    ]
}


def test_where_player_is_reads_the_trophy_that_opened_the_milestone() -> None:
    trophies = [_T('Ch1', 'Complete chapter 1', earned=True), _T('Ch2', 'Complete chapter 2')]
    assert chapters.where_player_is(GUIDE, trophies) == {('chapter', 2)}


def test_where_player_is_prefers_the_chapter_the_checklist_names() -> None:
    trophies = [_T('Ch1', 'Complete chapter 1', earned=True), _T('Ch2', 'x', earned=True)]
    assert chapters.where_player_is(GUIDE, trophies) == {('chapter', 3)}


def test_where_player_is_keeps_the_chapter_a_trophy_is_earned_in() -> None:
    trophies = [
        _T('Ch1', earned=True),
        _T('Ch2', earned=True),
        _T('Mark', 'Find the mark in Chapter 5', earned=True),
    ]
    assert chapters.where_player_is(GUIDE, trophies) == {('chapter', 5)}


def test_where_player_is_says_nothing_without_a_clue() -> None:
    assert chapters.where_player_is(GUIDE, [_T('Ch1')]) == set()
    assert chapters.where_player_is(None, []) == set()
    assert chapters.where_player_is({'milestones': [{'after': 'Gone', 'tips': []}]}, []) == set()
    guide: dict[str, Any] = {'milestones': [{'after': 'Opening', 'tips': []}]}
    assert (
        chapters.where_player_is(guide, [_T('Opening', 'Chapters 1 and 2', earned=True)]) == set()
    )
