import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SubgroupFilterNavbar.css';

export default function SubgroupFilterNavbar({ 
  onSelectMainGroup, 
  onSelectSubgroup, 
  activeMainGroup = 'All', 
  activeSubgroup = 'All' 
}) {
  const [hierarchy, setHierarchy] = useState([]);
  const [subgroupsList, setSubgroupsList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHierarchy();
  }, []);

  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_group_hierarchy');
      if (res.data?.message?.status === 'success') {
        setHierarchy(res.data.message.hierarchy || []);
      }
    } catch (err) {
      console.warn('Failed to load item group hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  const handleMainGroupClick = (groupName) => {
    onSelectMainGroup(groupName);
    onSelectSubgroup('All'); // Reset subgroup filter when main group changes

    if (groupName === 'All') {
      setSubgroupsList([]);
    } else {
      const match = hierarchy.find(h => h.main_group === groupName);
      setSubgroupsList(match ? match.subgroups : []);
    }
  };

  const handleSubgroupClick = (subName) => {
    onSelectSubgroup(subName);
  };

  return (
    <div className="subgroup-filter-navbar">
      {/* Top Bar: Main Groups */}
      <div className="main-groups-scroll">
        <button
          className={`main-group-pill ${activeMainGroup === 'All' ? 'active' : ''}`}
          onClick={() => handleMainGroupClick('All')}
        >
          All Items
        </button>
        {hierarchy.map(item => (
          <button
            key={item.main_group}
            className={`main-group-pill ${activeMainGroup === item.main_group ? 'active' : ''}`}
            onClick={() => handleMainGroupClick(item.main_group)}
          >
            {item.main_group}
          </button>
        ))}
      </div>

      {/* Secondary Bar: Subgroups of Selected Main Group */}
      {subgroupsList.length > 0 && (
        <div className="sub-groups-scroll">
          <span className="subgroup-label">Subcategories:</span>
          <button
            className={`sub-group-pill ${activeSubgroup === 'All' ? 'active' : ''}`}
            onClick={() => handleSubgroupClick('All')}
          >
            All {activeMainGroup}
          </button>
          {subgroupsList.map(sub => (
            <button
              key={sub}
              className={`sub-group-pill ${activeSubgroup === sub ? 'active' : ''}`}
              onClick={() => handleSubgroupClick(sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
