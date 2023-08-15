import { useState } from "react";
import { useDispatch } from "react-redux";
import { useHistory, useParams } from "react-router-dom";
import {createOneReview, fetchAllReviewsByRestaurantId} from '../../../store/reviews';
import {getSingleRestaurant} from '../../../store/restaurants'
import './CreateNewReview.css'

function CreateNewReview(){
  let {restaurantId} = useParams();
  restaurantId = parseInt(restaurantId)
  const dispatch = useDispatch();
  const history = useHistory();

  const [review, setReview] = useState("");
  const [rating, setRating] = useState("3");
  const [errors, setErrors] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = [];

    if (!review) validationErrors.push("Review is required.")
    if (review.length < 1 || review.length > 255) validationErrors.push("Reviews must be between 1 and 255 characters.")

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const newReview = {
      review,
      rating
    };

    try {
      await dispatch(createOneReview(newReview, restaurantId));
      await dispatch(getSingleRestaurant(restaurantId));
      await dispatch(fetchAllReviewsByRestaurantId(restaurantId));
      history.push(`/single/${restaurantId}`);
    } catch (res) {
      if (res.errors) setErrors(res.errors);
    }
  }

    return (
      <div  className="create-review-container">
        <h2>Create new Review</h2>
        <form onSubmit={handleSubmit} className="create-new-review-form">
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
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <button type="submit">Submit</button>
        </form>
      </div>
    )
}

export default CreateNewReview
