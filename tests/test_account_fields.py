"""
Account fields are normalised, and login checks the password once (#117).

- An email address is the same account whatever case it is typed in: signup
  used to make "OWNER@test.io" a second account next to "owner@test.io", and
  login with the other casing failed.
- A username is trimmed at signup, as editing a profile already did, and one
  differing from another only in case is taken.
- A blank first or last name is refused, rather than skipped with a 200.
- Login looks the account up once and checks one password, even for an
  address with no account, so how long a refusal takes no longer says which
  addresses are registered.
"""
import importlib.util
import pathlib

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

import app.api.auth_routes as auth_routes
import app.models.user as user_model
from app.models import User, db
from tests.conftest import login, visit

NEW = {"username": "newbie", "email": "new@example.com", "first_name": "New", "last_name": "Bie",
       "password": "password"}


def sign_up(client, **overrides):
    visit(client)
    return client.post("/api/auth/signup", json={**NEW, **overrides})


def log_in(client, email, password="password"):
    visit(client)
    return client.post("/api/auth/login", json={"email": email, "password": password})


# --- email addresses ----------------------------------------------------------------

def test_signing_up_again_in_capitals_is_the_same_address(client):
    res = sign_up(client, email="OWNER@test.io", username="owner2")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Email address is already in use."]
    assert User.query.count() == 3


def test_an_address_is_stored_trimmed_and_in_lower_case(client):
    res = sign_up(client, email="  New@Example.COM ")
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["email"] == "new@example.com"
    assert User.query.filter_by(username="newbie").one().email == "new@example.com"


@pytest.mark.parametrize("typed", ["Owner@Test.io", "OWNER@TEST.IO", "  owner@test.io  "])
def test_logging_in_however_the_address_is_typed(client, typed):
    """A phone's keyboard capitalises the first letter: that is still the owner's account."""
    res = log_in(client, typed)
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["email"] == "owner@test.io"


def test_an_account_stored_in_mixed_case_can_still_log_in(client):
    """Rows from before this, if the migration has not lower-cased them yet."""
    db.session.add(User(username="mixed", email="Mixed@Example.com", password="password",
                        first_name="Mix", last_name="Ed"))
    db.session.commit()
    assert log_in(client, "mixed@example.com").status_code == 200


def test_signing_up_with_the_address_of_a_mixed_case_account_is_refused(client):
    """A 400 that says so, not the database's refusal as a 500."""
    db.session.add(User(username="mixed", email="Mixed@Example.com", password="password",
                        first_name="Mix", last_name="Ed"))
    db.session.commit()
    res = sign_up(client, email="mixed@example.com")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Email address is already in use."]


def test_the_database_holds_one_account_per_address_too(app):
    db.session.add(User(username="shadow", email="OWNER@test.io", password="password",
                        first_name="Sha", last_name="Dow"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


# --- usernames ------------------------------------------------------------------------

@pytest.mark.parametrize("taken", ["owner ", "  owner", "Owner", "OWNER"])
def test_a_username_that_only_looks_different_is_taken(client, taken):
    res = sign_up(client, username=taken)
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Username is already in use."]


def test_a_username_and_names_are_stored_trimmed(client):
    res = sign_up(client, username="  newbie  ", first_name=" New ", last_name=" Bie ")
    assert res.status_code == 200, res.get_json()
    user = User.query.filter_by(email="new@example.com").one()
    assert (user.username, user.first_name, user.last_name) == ("newbie", "New", "Bie")


def test_a_name_of_only_spaces_is_no_name(client):
    res = sign_up(client, first_name="   ")
    assert res.status_code == 400
    assert "First name is required." in res.get_json()["errors"]


def test_editing_to_someone_elses_username_in_other_case_is_refused(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "Reviewer"})
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Username is already in use."]


def test_changing_the_case_of_your_own_username_is_fine(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "Owner"})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["username"] == "Owner"


def test_leaving_the_names_out_of_an_edit_keeps_them(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "owner"})
    assert res.status_code == 200
    assert (res.get_json()["first_name"], res.get_json()["last_name"]) == ("Olive", "Owner")


def test_names_are_trimmed_when_edited(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit",
                     json={"username": "owner", "first_name": " Liv ", "last_name": " O "})
    assert res.status_code == 200
    assert (res.get_json()["first_name"], res.get_json()["last_name"]) == ("Liv", "O")


# --- one password check a login -------------------------------------------------------

@pytest.fixture()
def password_checks(monkeypatch):
    """Every password hash checked during a request, counted."""
    checked = []

    def counting(real):
        def check(hashed, password):
            checked.append(hashed)
            return real(hashed, password)
        return check

    monkeypatch.setattr(user_model, "check_password_hash", counting(user_model.check_password_hash))
    monkeypatch.setattr(auth_routes, "check_password_hash", counting(auth_routes.check_password_hash))
    return checked


@pytest.mark.parametrize("email, password, status", [
    ("owner@test.io", "password", 200),         # it used to check this one twice
    ("owner@test.io", "wrong-password", 401),
    ("nobody@test.io", "password", 401),        # and this one not at all
])
def test_every_login_checks_exactly_one_password(client, password_checks, email, password, status):
    res = log_in(client, email, password)
    assert res.status_code == status
    assert len(password_checks) == 1, password_checks


def test_an_unknown_address_is_checked_against_a_stand_in_hash(client, password_checks):
    log_in(client, "nobody@test.io")
    assert password_checks == [auth_routes.UNKNOWN_ACCOUNT_HASH]


def test_every_refusal_says_the_same_thing(client):
    """Nothing in the answer tells a real address from a made-up one."""
    unknown = log_in(client, "nobody@test.io")
    wrong = log_in(client, "owner@test.io", "wrong-password")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.get_json() == wrong.get_json() == {"errors": ["Invalid credentials"]}


# --- the migration --------------------------------------------------------------------

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "b7e2d9c4a1f6_one_account_per_email_address.py")


@pytest.fixture()
def migration():
    spec = importlib.util.spec_from_file_location("email_case", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(step, connection):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    with Operations.context(MigrationContext.configure(connection)):
        step()


def users_table(connection, *emails):
    connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE)"))
    for index, email in enumerate(emails, start=1):
        connection.execute(text("INSERT INTO users (id, email) VALUES (:id, :email)"), {"id": index, "email": email})


def test_the_migration_stops_and_names_addresses_that_are_two_accounts(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        users_table(connection, "owner@test.io", "OWNER@test.io", "solo@test.io")
        with pytest.raises(RuntimeError, match=r"owner@test\.io \(2 accounts\)"):
            run(migration.upgrade, connection)
        # Nothing was changed on the way out.
        assert connection.execute(text("SELECT email FROM users ORDER BY id")).scalars().all() == [
            "owner@test.io", "OWNER@test.io", "solo@test.io"]


def test_the_migration_lower_cases_addresses_and_then_holds_the_rule(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        users_table(connection, "Owner@Test.io", "solo@test.io")
        run(migration.upgrade, connection)
        assert connection.execute(text("SELECT email FROM users ORDER BY id")).scalars().all() == [
            "owner@test.io", "solo@test.io"]
        with pytest.raises(IntegrityError):
            connection.execute(text("INSERT INTO users (id, email) VALUES (3, 'SOLO@test.io')"))


def test_the_migration_can_be_undone(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        users_table(connection, "owner@test.io")
        run(migration.upgrade, connection)
        run(migration.downgrade, connection)
        connection.execute(text("INSERT INTO users (id, email) VALUES (2, 'OWNER@test.io')"))
