'use client'

import { useRef, FormEvent } from "react";
import { useHMSActions } from "@100mslive/react-sdk";
import { ArrowRightIcon } from "@100mslive/react-icons";

export default function JoinForm() {
  const hmsActions = useHMSActions();
  const roomCodeRef = useRef<HTMLInputElement>(null);
  const userNameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // use room code to fetch auth token
    console.log('roomCodeRef.current?.value', roomCodeRef.current?.value);
    const authToken = await hmsActions.getAuthTokenByRoomCode({
      roomCode: roomCodeRef.current?.value || '',
    });

    try {
      await hmsActions.join({
        userName: userNameRef.current?.value || '',
        authToken,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="home">
      <img
        className="logo"
        src="https://www.100ms.live/assets/logo.svg"
        alt="logo"
        height={48}
        width={150}
      />
      <h2 style={{ marginTop: "2rem" }}>Join Room</h2>
      <p>Enter your room code and name before joining</p>
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            ref={roomCodeRef}
            id="room-code"
            type="text"
            name="roomCode"
            placeholder="Your Room Code"
          />
        </div>
        <div className="input-container">
          <input
            required
            ref={userNameRef}
            id="name"
            type="text"
            name="name"
            placeholder="Your Name"
          />
        </div>
        <button className="btn btn-primary" style={{ margin: "0 auto" }}>
          Join Now
          <ArrowRightIcon
            height={16}
            width={16}
            style={{ marginLeft: "0.25rem" }}
          />
        </button>
      </form>
    </div>
  );
}
