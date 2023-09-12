const GetUserProfile = 'session/GetUserProfile';
const EditProfile = 'session/EditProfile';

const getProfile = (userInfo) => ({
    type: GetUserProfile,
    userInfo
});

const editProf = (user) => ({
    type: EditProfile,
    payload: user
});

export const getProfileThunk = (userId) => async (dispatch) => {
    const response = await fetch(`/api/users/get/${userId}`, {
        headers: {
            'Content-Type': 'application/json',
        }
    });
    const reviewsResult = await fetch(`/api/reviews/${userId}`);
    if(response.ok && reviewsResult.ok){
        const userInfo = await response.json()
        const reviews = await reviewsResult.json()
        let result = {}
        result["id"] = userInfo.id
        result["reviews"] = reviews
        result["first_name"] = userInfo.first_name
        result["last_name"] = userInfo.last_name
        result["username"] = userInfo.username
        dispatch(getProfile(result));
        return
    }
    return null
};

export const editProfileThunk = (user, userId) => async (dispatch) => {
    const response = await fetch(`/api/users/${userId}/edit`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    });
    if(response.ok){
        const data = await response.json();
        dispatch(editProf(data));
        return userId;
    }else{
        return ["Username is already in use."]
    }
}

const initialState = {};

export default function userProfileReducer(state = initialState, action){
    let newState;
    switch (action.type){
        case GetUserProfile:
            newState = {...state}
            newState.user = {...action.userInfo}
            newState.user.reviews = {...action.userInfo.reviews}
            return { ...newState }
        default:
            return state;
    }
}
