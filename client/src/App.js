import React, { useState, useMemo } from "react";
import "./App.css";

function App() {
  const [urls, setUrls] = useState([""]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("metric");
  const [threshold, setThreshold] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState([]);

  const handleUrlChange = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addUrlField = () => {
    setUrls([...urls, ""]);
  };

  const removeUrlField = (index) => {
    if (urls.length <= 1) return;
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const validUrls = urls.filter((url) => url.trim() !== "");
      const results = await Promise.all(
        validUrls.map((url) =>
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/crux`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
          })
            .then((res) => res.json())
            .then((data) => ({ url, data }))
        )
      );
      setData(results);
      setSelectedUrls(results.map((item) => item.url));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleMetricFilterChange = (e) => {
    const options = e.target.options;
    const value = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        value.push(options[i].value);
      }
    }
    setSelectedMetrics(value);
  };

  const handleUrlFilterChange = (e) => {
    const options = e.target.options;
    const value = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        value.push(options[i].value);
      }
    }
    setSelectedUrls(value);
  };

  // Collect all unique metrics from API response
  const allMetrics = useMemo(() => {
    const metrics = new Set();
    data.forEach((item) => {
      if (item.data && item.data.record && item.data.record.metrics) {
        Object.keys(item.data.record.metrics).forEach((metric) =>
          metrics.add(metric)
        );
      }
    });
    return Array.from(metrics);
  }, [data]);

  // Summary stats: average, min, max, count for selected URLs and metrics
  const summaryData = useMemo(() => {
    if (!data.length) return null;

    const summary = {};

    allMetrics.forEach((metric) => {
      const values = data
        .filter(
          (item) => selectedUrls.length === 0 || selectedUrls.includes(item.url)
        )
        .map((item) => {
          const val = item.data?.record?.metrics?.[metric]?.percentiles?.p75;
          return val !== undefined ? parseFloat(val) : undefined;
        })
        .filter((val) => val !== undefined && !isNaN(val) && val >= threshold);
      console.log(values, "values for metric:", metric);
      console.log(allMetrics, "allMetrics");
      console.log(data, "data");
      console.log(selectedUrls, "selectedUrls");
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        summary[metric] = {
          average: avg,
          min,
          max,
          count: values.length,
        };
      }
    });

    return summary;
  }, [data, allMetrics, selectedUrls, threshold]);

  // Filter and sort data rows for table
  const filteredData = useMemo(() => {
    if (!data.length) return [];

    let rows = [];

    data.forEach((item) => {
      if (selectedUrls.length > 0 && !selectedUrls.includes(item.url)) return;

      if (item.data && item.data.record && item.data.record.metrics) {
        Object.entries(item.data.record.metrics).forEach(([metric, values]) => {
          if (selectedMetrics.length > 0 && !selectedMetrics.includes(metric))
            return;

          let val = values.percentiles?.p75;

          if (val !== undefined) {
            val = parseFloat(val);
            if (isNaN(val) || val < threshold) return;

            rows.push({
              url: item.url,
              metric,
              value: val,
            });
          }
        });
      }
    });

    // Sort rows
    rows.sort((a, b) => {
      let cmp = 0;
      if (orderBy === "metric") {
        cmp = a.metric.localeCompare(b.metric);
      } else if (orderBy === "value") {
        cmp = a.value - b.value;
      } else if (orderBy === "url") {
        cmp = a.url.localeCompare(b.url);
      }

      return order === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [data, selectedMetrics, selectedUrls, order, orderBy, threshold]);

  return (
    <div className="App">
      <h1>CrUX Dashboard</h1>

      <div>
        <h2>Input URLs</h2>
        {urls.map((url, index) => (
          <div key={index} style={{ marginBottom: 8 }}>
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(index, e.target.value)}
              placeholder="Enter URL"
              style={{ width: "300px" }}
            />
            <button
              onClick={() => removeUrlField(index)}
              disabled={urls.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button onClick={addUrlField}>Add URL</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {data.length > 0 && (
        <>
          <div style={{ marginTop: 20 }}>
            <h2>Filters</h2>

            <div className="filters-container">
              <label>
                Filter Metrics:
                <select
                  multiple
                  value={selectedMetrics}
                  onChange={handleMetricFilterChange}
                >
                  {allMetrics.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Filter URLs:
                <select
                  multiple
                  value={selectedUrls}
                  onChange={handleUrlFilterChange}
                >
                  {data.map((item) => (
                    <option key={item.url} value={item.url}>
                      {item.url}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Threshold (min percentile value):
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) =>
                    setThreshold(parseFloat(e.target.value) || 0)
                  }
                />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2>Details</h2>
            <table border="1" cellPadding="6" style={{ margin: "auto" }}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleRequestSort("url")}
                    style={{ cursor: "pointer" }}
                  >
                    URL {orderBy === "url" ? (order === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    onClick={() => handleRequestSort("metric")}
                    style={{ cursor: "pointer" }}
                  >
                    Metric{" "}
                    {orderBy === "metric" ? (order === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    onClick={() => handleRequestSort("value")}
                    style={{ cursor: "pointer" }}
                  >
                    Value (p75){" "}
                    {orderBy === "value" ? (order === "asc" ? "↑" : "↓") : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, idx) => (
                    <tr key={`${row.url}-${row.metric}-${idx}`}>
                      <td>{row.url}</td>
                      <td>{row.metric}</td>
                      <td>{row.value.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">No data to display</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2>Summary</h2>
            {summaryData ? (
              <table border="1" cellPadding="6" style={{ margin: "auto" }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Average</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaryData).map(([metric, stats]) => (
                    <tr key={metric}>
                      <td>{metric}</td>
                      <td>{stats.average.toFixed(2)}</td>
                      <td>{stats.min.toFixed(2)}</td>
                      <td>{stats.max.toFixed(2)}</td>
                      <td>{stats.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No summary data</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;