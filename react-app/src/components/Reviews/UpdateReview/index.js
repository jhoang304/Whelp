import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, useParams } from "react-router-dom";
import { updateOneReview, fetchAllReviewsByRestaurantId } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants'
import './UpdateReview.css'

function UpdateReview(){
  let { reviewId, restaurantId} = useParams();
  const oldReview = useSelector(state => {
    return state.reviews[reviewId]
  })

  const dispatch = useDispatch();
  const history = useHistory();

  // The review may not be in the store yet (e.g. arriving from the profile page).
  const [review, setReview] = useState(oldReview ? oldReview.review : "");
  const [rating, setRating] = useState(oldReview ? oldReview.rating : 5);
  const [errors, setErrors] = useState([]);

  useEffect( () => {
    dispatch(getSingleRestaurant(restaurantId));
    if (!oldReview) dispatch(fetchAllReviewsByRestaurantId(restaurantId));
  }, [dispatch, restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (oldReview) {
      setReview(oldReview.review);
      setRating(oldReview.rating);
    }
  }, [oldReview]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = [];

    if (!review) validationErrors.push("Review is required.")
    if (review.length < 1 || review.length > 255) validationErrors.push("Reviews must be between 1 and 255 characters.")

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);

    const newReview = {
      review,
      rating
    };

    await dispatch(updateOneReview(newReview,reviewId))
      .then(() => dispatch(fetchAllReviewsByRestaurantId(restaurantId)))
      .then(() => dispatch(getSingleRestaurant(restaurantId)))
      .catch(async (res) => {
        const data = await res.json();
        if (data && data.errors) setErrors(data.errors);
      });
      history.push(`/single/${restaurantId}`)
    }

    return (
      <div  className="update-review-container">
        <h2>Update Review</h2>
        <form onSubmit={handleSubmit} className="update-new-review-form">
          <ul>
            {errors.map((error, idx) => <li key={idx}>{error}</li>)}
          </ul>
          <label>
            <span>review:</span>
            <input
              type="text"
              value={review}
              onChange={e => setReview(e.target.value)}
              required
            />
          </label>
          <label>
          <span>rating:</span>
            <select onChange={e => setRating(e.target.value)} value={rating}>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
          </select>
          </label>
          <button type="submit">Submit</button>
        </form>
      </div>
    )
}

export default UpdateReview
