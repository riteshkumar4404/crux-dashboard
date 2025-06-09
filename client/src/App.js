import React, { useState, useMemo } from 'react';
import './App.css';

function App() {
  const [urls, setUrls] = useState(['']);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('metric');
  const [threshold, setThreshold] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedUrls, setSelectedUrls] = useState([]);

  const handleUrlChange = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index) => {
    if (urls.length <= 1) return;
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const validUrls = urls.filter(url => url.trim() !== '');
      const results = await Promise.all(
        validUrls.map(url =>
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/crux`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          })

            .then(res => res.json())
            .then(data => ({ url, data }))
        )
      );
      setData(results);
      setSelectedUrls(results.map(item => item.url));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
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

  const allMetrics = useMemo(() => {
    const metrics = new Set();
    data.forEach(item => {
      if (item.data && item.data.metrics) {
        Object.keys(item.data.metrics).forEach(metric => metrics.add(metric));
      }
    });
    return Array.from(metrics);
  }, [data]);

  const summaryData = useMemo(() => {
    if (!data.length) return null;

    const summary = {};

    allMetrics.forEach(metric => {
      const values = data
        .filter(item => selectedUrls.length === 0 || selectedUrls.includes(item.url))
        .map(item => item.data?.metrics?.[metric]?.percentiles?.p75)
        .filter(val => val !== undefined);

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        summary[metric] = {
          average: avg * 100,
          min: min * 100,
          max: max * 100,
          count: values.length
        };
      }
    });

    return summary;
  }, [data, allMetrics, selectedUrls]);

  const filteredData = useMemo(() => {
    if (!data.length) return [];

    let result = [];

    data.forEach(item => {
      if (selectedUrls.length > 0 && !selectedUrls.includes(item.url)) return;

      if (item.data && item.data.metrics) {
        Object.entries(item.data.metrics).forEach(([metric, values]) => {
          if (selectedMetrics.length > 0 && !selectedMetrics.includes(metric)) return;
          if (values.percentiles.p75 * 100 < threshold) return;

          result.push({
            url: item.url,
            metric,
            ...values
          });
        });
      }
    });

    // Apply sorting
    return result.sort((a, b) => {
      const aValue = orderBy === 'metric' ? a.metric :
        orderBy === 'url' ? a.url :
          a.percentiles.p75;
      const bValue = orderBy === 'metric' ? b.metric :
        orderBy === 'url' ? b.url :
          b.percentiles.p75;

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, order, orderBy, threshold, selectedMetrics, selectedUrls]);

  return (
    <div className="app-container">
      <h1 className="app-title">CrUX Data Dashboard</h1>

      <div className="url-input-container">
        {urls.map((url, index) => (
          <div className="url-input-group" key={index}>
            <input
              type="text"
              placeholder={`URL ${index + 1}`}
              className="url-input"
              value={url}
              onChange={(e) => handleUrlChange(index, e.target.value)}
            />
            {index === urls.length - 1 ? (
              <button className="add-url-btn" onClick={addUrlField}>+</button>
            ) : (
              <button className="remove-url-btn" onClick={() => removeUrlField(index)}>-</button>
            )}
          </div>
        ))}
      </div>

      <button
        className="search-btn"
        onClick={handleSearch}
        disabled={loading || urls.every(url => !url.trim())}
      >
        {loading ? 'Loading...' : 'Search'}
      </button>

      {data.length > 0 && (
        <>
          <div className="filter-container">
            <div className="filter-group">
              <label>Metrics:</label>
              <select
                multiple
                value={selectedMetrics}
                onChange={handleMetricFilterChange}
                className="multi-select"
              >
                {allMetrics.map((metric) => (
                  <option key={metric} value={metric}>{metric}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>URLs:</label>
              <select
                multiple
                value={selectedUrls}
                onChange={handleUrlFilterChange}
                className="multi-select"
              >
                {data.map((item) => (
                  <option key={item.url} value={item.url}>{item.url}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Min Good %:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="threshold-input"
              />
            </div>
          </div>

          {summaryData && (
            <div className="summary-card">
              <h2>Summary Statistics</h2>
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Avg. Good %</th>
                    <th>Min Good %</th>
                    <th>Max Good %</th>
                    <th>URL Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaryData).map(([metric, stats]) => (
                    <tr key={metric}>
                      <td>{metric}</td>
                      <td>{stats.average.toFixed(2)}%</td>
                      <td>{stats.min.toFixed(2)}%</td>
                      <td>{stats.max.toFixed(2)}%</td>
                      <td>{stats.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th
                    className={`sortable ${orderBy === 'url' ? 'active' : ''}`}
                    onClick={() => handleRequestSort('url')}
                  >
                    URL {orderBy === 'url' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className={`sortable ${orderBy === 'metric' ? 'active' : ''}`}
                    onClick={() => handleRequestSort('metric')}
                  >
                    Metric {orderBy === 'metric' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Good (ms)</th>
                  <th>Needs Improvement (ms)</th>
                  <th>Poor (ms)</th>
                  <th
                    className={`sortable ${orderBy === 'p75' ? 'active' : ''}`}
                    onClick={() => handleRequestSort('p75')}
                  >
                    Percentage Good {orderBy === 'p75' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr key={index}>
                    <td className="url-cell">{row.url}</td>
                    <td>{row.metric}</td>
                    <td>{row.histogram[0].start}</td>
                    <td>{row.histogram[1].start}</td>
                    <td>{row.histogram[2].start}</td>
                    <td className="percentage-cell">
                      {(row.percentiles.p75 * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;