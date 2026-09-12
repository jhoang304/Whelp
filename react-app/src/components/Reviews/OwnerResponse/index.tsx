import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { AppDispatch } from "../../../store";
import { Review } from "../../../types";
import {
  createReviewResponse,
  updateReviewResponse,
  deleteReviewResponse,
} from "../../../store/reviews";
import { avatarUrl, onAvatarError } from "../../../utils/images";
import "./OwnerResponse.css";

export const MAX_RESPONSE_LENGTH = 1000;

interface OwnerResponseProps {
  review: Review;
  /** true when the logged-in user owns the reviewed business */
  canManage: boolean;
  businessName?: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * The business owner's public reply under a review. Read-only for everyone
 * except the owner, who can post, edit, and delete their response inline.
 */
function OwnerResponse({ review, canManage, businessName }: OwnerResponseProps): React.JSX.Element | null {
  const dispatch = useDispatch<AppDispatch>();
  const response = review.response || null;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [text, setText] = useState<string>(response ? response.response : "");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!response && !canManage) return null;

  const startEditing = () => {
    setText(response ? response.response : "");
    setErrors([]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setErrors(["Write a response before posting."]);
      return;
    }
    if (trimmed.length > MAX_RESPONSE_LENGTH) {
      setErrors([`Responses must be ${MAX_RESPONSE_LENGTH} characters or fewer.`]);
      return;
    }

    setIsSaving(true);
    const action = response
      ? updateReviewResponse(review.id, trimmed)
      : createReviewResponse(review.id, trimmed);
    const result: string[] | null = await dispatch(action as any);
    setIsSaving(false);

    if (result) {
      setErrors(result);
    } else {
      setIsEditing(false);
      setErrors([]);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete your response to this review?")) return;
    const result: string[] | null = await dispatch(deleteReviewResponse(review.id) as any);
    if (result) setErrors(result);
  };

  const errorList = errors.length > 0 && (
    <ul className="owner-response-errors">
      {errors.map((error, idx) => (
        <li key={idx}>{error}</li>
      ))}
    </ul>
  );

  const form = (
    <form className="owner-response-form" onSubmit={handleSubmit}>
      <label className="owner-response-label" htmlFor={`owner-response-${review.id}`}>
        {response ? "Edit your response" : "Respond as the business owner"}
      </label>
      <textarea
        id={`owner-response-${review.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_RESPONSE_LENGTH}
        rows={4}
        placeholder="Thank the reviewer, add context, or explain how you're addressing their feedback."
        autoFocus
      />
      <div className="owner-response-form-footer">
        <span className={`owner-response-count${text.length > MAX_RESPONSE_LENGTH - 50 ? " near-limit" : ""}`}>
          {text.length}/{MAX_RESPONSE_LENGTH}
        </span>
        <div className="owner-response-form-buttons">
          <button type="button" className="owner-response-secondary" onClick={cancelEditing} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="owner-response-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : response ? "Save changes" : "Post response"}
          </button>
        </div>
      </div>
      {errorList}
    </form>
  );

  if (!response) {
    return (
      <div className="owner-response owner-response-empty">
        {isEditing ? (
          form
        ) : (
          <button type="button" className="owner-response-cta" onClick={startEditing}>
            <i className="fa-solid fa-reply"></i>
            Respond to this review
          </button>
        )}
        {!isEditing && errorList}
      </div>
    );
  }

  const owner = response.user;
  const ownerName = owner
    ? `${owner.first_name} ${owner.last_name ? `${owner.last_name.charAt(0)}.` : ""}`.trim()
    : "Business owner";
  const wasEdited = response.updatedAt !== response.createdAt;

  return (
    <div className="owner-response">
      <div className="owner-response-header">
        <img className="owner-response-avatar" src={avatarUrl(owner)} alt="" onError={onAvatarError} />
        <div className="owner-response-heading">
          <div className="owner-response-title">
            Response from{" "}
            {owner ? <Link to={`/users/get/${owner.id}`}>{ownerName}</Link> : ownerName}
            {businessName && <span className="owner-response-business"> · Owner of {businessName}</span>}
          </div>
          <div className="owner-response-date">
            {formatDate(response.updatedAt || response.createdAt)}
            {wasEdited ? " (edited)" : ""}
          </div>
        </div>
        {canManage && !isEditing && (
          <div className="owner-response-actions">
            <button type="button" onClick={startEditing}>
              <i className="fa-solid fa-pen"></i>
              Edit
            </button>
            <button type="button" className="danger" onClick={handleDelete}>
              <i className="fa-solid fa-trash"></i>
              Delete
            </button>
          </div>
        )}
      </div>
      {isEditing ? form : <p className="owner-response-body">{response.response}</p>}
      {!isEditing && errorList}
    </div>
  );
}

export default OwnerResponse;
