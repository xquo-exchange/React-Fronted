import React from "react";
import "./StakeBox.css";

const StakeBox = () => {

    
    return (
        <div className="stake-box">
            <h2 className="stake-box-title">Stake</h2>
            <div className="stake-box-content">
                
                <input
                    type="number"
                    className="stake-box-input"
                    placeholder="Amount to stake"
                />

                <button className="stake-box-button">Stake</button>
            </div>

        </div>
    );
};

export default StakeBox;