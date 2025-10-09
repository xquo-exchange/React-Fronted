import React, { useState } from "react";
import "./Graph.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Graph = () => {
  const [selectedDate, setSelectedDate] = useState(null);

  return (
    <div className="graph-box">

      <div className="filter-container">
        <div className="date-selector">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            placeholderText="Date"
            className="custom-datepicker"
          />
        </div>

        <button className="filter-button">
          Filter
          <span className="filter-icon">⚙️</span>
        </button>
      </div>
    </div>
  );
};

export default Graph;
