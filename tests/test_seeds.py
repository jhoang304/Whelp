from app.models import Restaurant, Review, ReviewResponse, User

SEEDED_USERS = 6
SEEDED_RESTAURANTS = 10
SEEDED_REVIEWS = 34
SEEDED_RESPONSES = 11


def test_seed_all_skips_when_database_has_data(app):
    """The deploy build command runs `flask seed all`; it must never wipe real data."""
    runner = app.test_cli_runner()
    before = User.query.count()
    assert before > 0

    result = runner.invoke(args=["seed", "all"])

    assert result.exit_code == 0, result.output
    assert "skipping seed" in result.output
    assert User.query.count() == before
    assert User.query.filter_by(username="owner").first() is not None


def test_seed_all_reset_wipes_and_reseeds(app):
    runner = app.test_cli_runner()

    result = runner.invoke(args=["seed", "all", "--reset"])

    assert result.exit_code == 0, result.output
    assert User.query.filter_by(username="owner").first() is None
    assert User.query.count() == SEEDED_USERS
    assert Restaurant.query.count() == SEEDED_RESTAURANTS
    assert Review.query.count() == SEEDED_REVIEWS
    assert ReviewResponse.query.count() == SEEDED_RESPONSES

    # a plain re-run afterwards is a no-op
    result = runner.invoke(args=["seed", "all"])
    assert result.exit_code == 0, result.output
    assert "skipping seed" in result.output
    assert User.query.count() == SEEDED_USERS


def test_seed_all_populates_an_empty_database(app):
    runner = app.test_cli_runner()

    result = runner.invoke(args=["seed", "undo"])
    assert result.exit_code == 0, result.output
    assert User.query.count() == 0

    result = runner.invoke(args=["seed", "all"])
    assert result.exit_code == 0, result.output
    assert "Seeded the database" in result.output
    assert User.query.count() == SEEDED_USERS
    assert ReviewResponse.query.count() == SEEDED_RESPONSES
