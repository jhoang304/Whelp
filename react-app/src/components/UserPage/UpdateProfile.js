import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { editProfileThunk, getProfileThunk } from '../../store/userProfile'
import { useModal } from '../../context/Modal.js'
import './UpdateProfile.css'

export default function UpdateProfile({user}){
  const dispatch = useDispatch()
  const { closeModal } = useModal()
  const [username, setUsername] = useState(user.username)
  const [errors, setErrors] = useState([])


  const handleUpdate = async (e) => {
    e.preventDefault();
    const newUser = {
      username
    }

    const updatedUserProfile = await dispatch(editProfileThunk(newUser, user.id))

    if (typeof(updatedUserProfile) == "number"){
      dispatch(getProfileThunk(user.id))
        .then(closeModal())
    }else{
      setErrors(updatedUserProfile)
    }
  }

  return (
    <div className='update-profile-container'>
      <h2>Update Profile</h2>
      <div>
        <form className='update-profile-form' onSubmit={handleUpdate}>
          <lable className='update-profile-item'>
            <span>Username:</span>
            <input
              type="string"
              value={username}
              onChange = {(e) => setUsername(e.target.value)}
            />
          </lable>
          <button className='update-profile-button' type="submit"> Submit </button>
        </form>
      </div>
    </div>
  )
}
