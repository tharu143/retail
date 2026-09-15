import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const scrollRef = useRef(null);

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

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="subgroup-filter-navbar">
      {/* Top Bar: Main Groups Carousel with Scroll Controls */}
      <div className="main-groups-wrapper">
        <button type="button" className="carousel-arrow-btn left" onClick={scrollLeft} title="Scroll Left">
          <ChevronLeft size={16} />
        </button>
        <div className="main-groups-scroll" ref={scrollRef}>
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
        <button type="button" className="carousel-arrow-btn right" onClick={scrollRight} title="Scroll Right">
          <ChevronRight size={16} />
        </button>
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

