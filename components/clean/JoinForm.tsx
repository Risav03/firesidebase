"use client";

import { useState } from "react";

interface JoinFormProps {
  onJoin: (appId: string, channelName: string, token: string, uid: string) => void;
}

function JoinForm({ onJoin }: JoinFormProps) {
  const [inputValues, setInputValues] = useState({
    appId: "",
    channelName: "",
    token: "",
    uid: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValues((prevValues) => ({
      ...prevValues,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { appId, channelName, token, uid } = inputValues;
    
    if (appId && channelName) {
      onJoin(appId, channelName, token || '', uid || '');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="join-form">
      <h2>Join Agora Channel</h2>
      <div className="input-container">
        <input
          required
          value={inputValues.appId}
          onChange={handleInputChange}
          id="appId"
          type="text"
          name="appId"
          placeholder="App ID"
        />
      </div>
      <div className="input-container">
        <input
          required
          value={inputValues.channelName}
          onChange={handleInputChange}
          id="channelName"
          type="text"
          name="channelName"
          placeholder="Channel Name"
        />
      </div>
      <div className="input-container">
        <input
          value={inputValues.token}
          onChange={handleInputChange}
          id="token"
          type="text"
          name="token"
          placeholder="Token (optional)"
        />
      </div>
      <div className="input-container">
        <input
          value={inputValues.uid}
          onChange={handleInputChange}
          id="uid"
          type="text"
          name="uid"
          placeholder="UID (optional)"
        />
      </div>
      <button className="btn-primary" type="submit">Join</button>
    </form>
  );
}

export default JoinForm;
