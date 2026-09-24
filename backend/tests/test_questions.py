from app.core import cache
from app.main import app
from app.models.question import Question
from app.models.topic import Topic
from app.models.user import User
from app.services.catalog import CATALOG_CACHE_KEY


def test_questions_require_auth(client):
    response = client.get("/api/v1/questions")
    assert response.status_code == 401


def test_list_questions_empty(client, auth_headers):
    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_and_filter_questions(client, db_session, auth_headers):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="wetterkunde", number=1, question_text="Q2?", answer_text="A2"),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = client.get("/api/v1/questions", params={"subject": "navigation"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "navigation"


def test_list_questions_is_served_from_cache(client, db_session, auth_headers):
    db_session.add(Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"))
    db_session.commit()

    first = client.get("/api/v1/questions", headers=auth_headers)
    assert len(first.json()) == 1

    # Added straight to the DB, bypassing anything that would invalidate the
    # cache — proves the second request is served from the cached catalog,
    # not a fresh query.
    db_session.add(Question(subject="navigation", number=2, question_text="Q2?", answer_text="A2"))
    db_session.commit()

    second = client.get("/api/v1/questions", headers=auth_headers)
    assert len(second.json()) == 1

    cache.invalidate(app, CATALOG_CACHE_KEY)
    third = client.get("/api/v1/questions", headers=auth_headers)
    assert len(third.json()) == 2


def test_list_questions_filtered_by_topic(client, db_session, auth_headers):
    topic_a = Topic(subject="navigation", slug="topic-a", name="Topic A", display_order=1)
    topic_b = Topic(subject="navigation", slug="topic-b", name="Topic B", display_order=2)
    db_session.add_all([topic_a, topic_b])
    db_session.commit()

    db_session.add_all(
        [
            Question(
                subject="navigation", number=1, question_text="Q1?", answer_text="A1", topic_id=topic_a.id
            ),
            Question(
                subject="navigation", number=2, question_text="Q2?", answer_text="A2", topic_id=topic_b.id
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions", params={"topic": "topic-a"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["number"] == 1
    assert data[0]["topic"] == "topic-a"


def test_list_questions_sorted_by_topic_display_order(client, db_session, auth_headers):
    early = Topic(subject="navigation", slug="early", name="Early", display_order=1)
    late = Topic(subject="navigation", slug="late", name="Late", display_order=2)
    db_session.add_all([early, late])
    db_session.commit()

    # Inserted in an order that would come out wrong if sorting fell back to number/id.
    db_session.add_all(
        [
            Question(subject="navigation", number=5, question_text="Q5?", answer_text="A5", topic_id=late.id),
            Question(
                subject="navigation", number=1, question_text="Q1?", answer_text="A1", topic_id=early.id
            ),
            Question(subject="navigation", number=2, question_text="Q2?", answer_text="A2", topic_id=None),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    numbers = [q["number"] for q in response.json()]
    # early's topic first, then late's, then the untagged question last within the subject.
    assert numbers == [1, 5, 2]


def test_list_topics(client, db_session, auth_headers):
    db_session.add_all(
        [
            Topic(subject="navigation", slug="b", name="B", display_order=2),
            Topic(subject="navigation", slug="a", name="A", display_order=1),
            Topic(subject="wetterkunde", slug="c", name="C", display_order=1),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/topics", headers=auth_headers)
    assert response.status_code == 200
    slugs = [t["slug"] for t in response.json()]
    assert slugs == ["a", "b", "c"]

    response = client.get("/api/v1/topics", params={"subject": "wetterkunde"}, headers=auth_headers)
    assert response.status_code == 200
    assert [t["slug"] for t in response.json()] == ["c"]


def test_topics_require_auth(client):
    response = client.get("/api/v1/topics")
    assert response.status_code == 401


def test_list_questions_filters_by_exam_variant_when_no_subject_given(client, db_session, auth_headers):
    db_session.add_all(
        [
            Question(subject="navigation", number=1, question_text="Q1?", answer_text="A1"),
            Question(subject="seemannschaft_motor", number=1, question_text="Q2?", answer_text="A2"),
            Question(subject="seemannschaft_segeln", number=1, question_text="Q3?", answer_text="A3"),
        ]
    )
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    user.exam_variant = "motor"
    db_session.commit()

    response = client.get("/api/v1/questions", headers=auth_headers)
    assert response.status_code == 200
    subjects = {q["subject"] for q in response.json()}
    assert subjects == {"navigation", "seemannschaft_motor"}


def test_list_topics_filters_by_exam_variant_when_no_subject_given(client, db_session, auth_headers):
    db_session.add_all(
        [
            Topic(subject="navigation", slug="nav", name="Navigation", display_order=1),
            Topic(subject="seemannschaft_motor", slug="motor", name="Motor", display_order=1),
            Topic(subject="seemannschaft_segeln", slug="segeln", name="Segeln", display_order=1),
        ]
    )
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    user.exam_variant = "motor"
    db_session.commit()

    response = client.get("/api/v1/topics", headers=auth_headers)
    assert response.status_code == 200
    slugs = {t["slug"] for t in response.json()}
    assert slugs == {"nav", "motor"}


def test_list_topics_explicit_subject_overrides_exam_variant(client, db_session, auth_headers):
    db_session.add(Topic(subject="seemannschaft_segeln", slug="segeln", name="Segeln", display_order=1))
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    user.exam_variant = "motor"
    db_session.commit()

    response = client.get("/api/v1/topics", params={"subject": "seemannschaft_segeln"}, headers=auth_headers)
    assert response.status_code == 200
    assert [t["slug"] for t in response.json()] == ["segeln"]


def test_explicit_subject_overrides_exam_variant(client, db_session, auth_headers):
    db_session.add(Question(subject="seemannschaft_segeln", number=1, question_text="Q1?", answer_text="A1"))
    user = db_session.query(User).filter_by(email="fixture-user@example.com").one()
    user.exam_variant = "motor"
    db_session.commit()

    response = client.get(
        "/api/v1/questions", params={"subject": "seemannschaft_segeln"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_question_carries_its_images(client, db_session, auth_headers):
    image = {"src": "schifffahrtsrecht-23-1.png", "width": 64, "height": 49}
    question = Question(
        subject="schifffahrtsrecht",
        number=23,
        question_text="Q?",
        answer_text="A",
        question_images=[image],
    )
    db_session.add(question)
    db_session.commit()
    db_session.refresh(question)

    [data] = client.get(
        "/api/v1/questions", params={"subject": "schifffahrtsrecht"}, headers=auth_headers
    ).json()
    assert data["question_images"] == [image]
    assert data["answer_images"] == []
