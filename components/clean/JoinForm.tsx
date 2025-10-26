"use client";

import { useState } from "react";
import { useHMSActions } from "@100mslive/react-sdk";

function JoinForm() {
  const hmsActions = useHMSActions();
  const [inputValues, setInputValues] = useState({
    name: "",
    roomCode: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValues((prevValues) => ({
      ...prevValues,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name: userName = '', roomCode = '' } = inputValues;

    try {
      // use room code to fetch auth token
      const authToken = await hmsActions.getAuthTokenByRoomCode({ roomCode });
      
      await hmsActions.join({ userName, authToken });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="join-form">
      <h2>Join Room</h2>
      <div className="input-container">
        <input
          required
          value={inputValues.name}
          onChange={handleInputChange}
          id="name"
          type="text"
          name="name"
          placeholder="Your name"
        />
      </div>
      <div className="input-container">
        <input
          id="room-code"
          type="text"
          name="roomCode"
          placeholder="Room code"
          value={inputValues.roomCode}
          onChange={handleInputChange}
        />
      </div>
      <button className="btn-primary" type="submit">Join</button>
    </form>
  );
}

export default JoinForm;

