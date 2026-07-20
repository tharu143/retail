  2640	                <div className="po-card">
  2641	                  <div className="po-card-header flex items-center justify-between">
  2642	                    <h3 className="po-card-title">Product Inventory Basket</h3>
  2643	                    <button
  2644	                      type="button"
  2645	                      onClick={() => setShowColConfig(true)}
  2646	                      title="Configure Columns"
  2647	                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-[11px] font-bold"
  2648	                    >
  2649	                      <Settings size={15} />
  2650	                      <span>Columns</span>
  2651	                    </button>
  2652	                  </div>
  2653	
  2654	                  {!isViewOnly && formData.docstatus === 0 && (
  2655	                    <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 bg-white animate-fadeIn">
  2656	                      <div className="relative flex-1 group">
  2657	                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10b981] transition-colors">
  2658	                          <Scan className="w-4 h-4" />
  2659	                        </div>
  2660	                        <input
  2661	                          type="text"
  2662	                          placeholder="Enter Barcode / Scan here..."
  2663	                          className="w-full pl-10 pr-12 h-[42px] bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#10b981] focus:bg-white transition-all shadow-sm"
  2664	                          onKeyDown={async (e) => {
  2665	                            if (e.key === 'Enter') {
  2666	                              const barcode = e.target.value.trim();
  2667	                              if (barcode) {
  2668	                                await handleBarcodeEnter({ key: 'Enter', target: { value: barcode } }, formData.items.length - 1);
  2669	                                e.target.value = '';
  2670	                              }
  2671	                            }
  2672	                          }}
  2673	                        />
  2674	                        <button
  2675	                          type="button"
  2676	                          onClick={startCameraScanner}
  2677	                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#10b981] hover:bg-emerald-50 rounded-lg transition-all"
  2678	                          title="Start Camera Scanner"
  2679	                        >
  2680	                          <Camera className="w-4 h-4" />
  2681	                        </button>
  2682	                      </div>
  2683	                      <button type="button" onClick={addItemRow} className="po-btn-secondary h-[42px] px-8 rounded-xl flex items-center gap-2">
  2684	                        <Plus className="w-4 h-4" /> Add Row
  2685	                      </button>
  2686	                    </div>
  2687	                  )}
  2688	
  2689	                  {isScannerOpen && createPortal(
  2690	                    <div
  2691	                      className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fadeIn"
  2692	                      onDragOver={handleDragOver}
  2693	                      onDragLeave={handleDragLeave}
  2694	                      onDrop={handleDrop}
  2695	                    >
  2696	                      <div className={`relative w-full max-w-lg aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border-4 transition-all duration-300 ${isDragging ? 'border-emerald-500 scale-105 ring-4 ring-emerald-500/20' : 'border-emerald-500/30'}`}>
  2697	                        {isDragging ? (
  2698	                          <div className="absolute inset-0 bg-emerald-600/40 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-pulse">
  2699	                            <Upload className="w-16 h-16 text-white mb-4" />
  2700	                            <p className="text-white font-bold text-lg uppercase tracking-widest">Drop Image to Scan</p>
  2701	                          </div>
  2702	                        ) : (
  2703	                          <>
  2704	                            <div id="po-scanner-reader" className="w-full h-full" style={{ background: '#000' }}></div>
  2705	                            <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none flex items-center justify-center">
  2706	                              <div className="w-full h-full border-2 border-emerald-400/50 relative">
  2707	                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
  2708	                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
  2709	                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
  2710	                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
  2711	                                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] absolute animate-scanLine" />
  2712	                              </div>
  2713	                            </div>
  2714	                          </>
  2715	                        )}
  2716	
  2717	                        <div className="absolute top-4 right-4 flex gap-2">
  2718	                          <label className="w-10 h-10 bg-white/10 hover:bg-emerald-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20 cursor-pointer group" title="Upload Image">
  2719	                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
  2720	                            <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
  2721	                          </label>
  2722	                          <button
  2723	                            onClick={stopCameraScanner}
  2724	                            className="w-10 h-10 bg-white/10 hover:bg-red-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20"
  2725	                          >
  2726	                            <X className="w-5 h-5" />
  2727	                          </button>
  2728	                        </div>
  2729	
  2730	                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
  2731	                          <div className="text-white bg-emerald-600/80 backdrop-blur-md px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg whitespace-nowrap">
  2732	                            {isDragging ? 'Release to Scan' : 'Align Barcode or Drop Image'}
  2733	                          </div>
  2734	                        </div>
  2735	                      </div>
  2736	                    </div>,
  2737	                    document.body
  2738	                  )}
  2739	
  2740	                  <div className="purchase-table-container">
  2741	                    <table className="purchase-table">
  2742	                      <thead>
  2743	                        <tr>
  2744	                          {(() => {
  2745	                            const hasAnyBox = formData.items.some(i => i.use_box_entry);
  2746	                            const activeCols = poColumns.filter(c => {
  2747	                              if (!c.visible) return false;
  2748	                              if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
  2749	                              return true;
  2750	                            });
  2751	
  2752	                            return activeCols.map(col => {
  2753	                              let finalLabel = col.label;
  2754	
  2755	                              if (!hasAnyBox) {
  2756	                                if (col.id === 'custom_box_qty') finalLabel = 'Qty';
  2757	                                if (col.id === 'custom_box_price') finalLabel = 'Price';
  2758	                                if (col.id === 'custom_pieces_per_box') finalLabel = '';
  2759	                              }
  2760	
  2761	                              let alignClass = "text-center";
  2762	                              if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
  2763	                                alignClass = "text-left pl-3";
  2764	                              } else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) {
  2765	                                alignClass = "text-right pr-3";
  2766	                              }
  2767	
  2768	                              return (
  2769	                                <th
  2770	                                  key={col.id}
  2771	                                  className={`purchase-th ${alignClass}`}
  2772	                                  style={{ width: col.width, minWidth: col.id === 'item_code' ? 120 : undefined }}
  2773	                                >
  2774	                                  {finalLabel.split('\n').map((line, i) => (
  2775	                                    <React.Fragment key={i}>
  2776	                                      {line}
  2777	                                      {i < finalLabel.split('\n').length - 1 && <br />}
  2778	                                    </React.Fragment>
  2779	                                  ))}
  2780	                                </th>
  2781	                              );
  2782	                            });
  2783	                          })()}
  2784	                          <th className="purchase-th w-[50px]"></th>
  2785	                        </tr>
  2786	                      </thead>
  2787	                      <tbody>
  2788	                        {formData.items.map((item, idx) => (
  2789	                          <tr key={idx} tabIndex={-1} data-row-index={idx} className="group hover:bg-slate-50 transition-colors">
  2790	                            {(() => {
  2791	                              const hasAnyBox = formData.items.some(i => i.use_box_entry);
  2792	                              const activeCols = poColumns.filter(c => {
  2793	                                if (!c.visible) return false;
  2794	                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
  2795	                                return true;
  2796	                              });
  2797	
  2798	                              return activeCols.map(col => {
  2799	                                switch (col.id) {
  2800	                                  case 'scanner':
  2801	                                    return (
  2802	                                      <td key={col.id} className="purchase-td">
  2803	                                        <div className="premium-cell-container">
  2804	                                          <div className="premium-cell-box">
  2805	                                            <input
  2806	                                              type="text"
  2807	                                              value={item.temp_barcode ?? ''}
  2808	                                              placeholder={isViewOnly ? '' : 'Barcode'}
  2809	                                              readOnly={isViewOnly || formData.docstatus !== 0}
  2810	                                              onChange={(e) => handleBarcodeScan(e, idx)}
  2811	                                              onFocus={(e) => e.target.select()}
  2812	                                              onClick={(e) => e.target.select()}
  2813	                                              onKeyDown={(e) => {
  2814	                                                if (e.key === 'Enter' && e.target.value) handleBarcodeEnter(e, idx);
  2815	                                                else handleNextFocus(e);
  2816	                                              }}
  2817	                                              className="text-center font-bold"
  2818	                                            />
  2819	                                          </div>
  2820	                                        </div>
  2821	                                      </td>
  2822	                                    );
  2823	                                  case 'item_code':
  2824	                                    return (
  2825	                                      <td key={col.id} className="purchase-td" style={{ verticalAlign: 'middle' }}>
  2826	                                        <div className="premium-cell-container" style={{ minHeight: '36px', justifyContent: 'center' }}>
  2827	                                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
  2828	                                            {!(isViewOnly || formData.docstatus !== 0) ? (
  2829	                                              <CustomSearchDropdown
  2830	                                                value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
  2831	                                                placeholder="Search item..."
  2832	                                                onSelect={(val) => handleItemSelect(val, idx)}
  2833	                                                themeColor="var(--po-primary)"
  2834	                                                optionsLabel="name"
  2835	                                                fetchData={fetchItems}
  2836	                                                globalSearch={true}
  2837	                                                onGlobalSearch={handleGlobalItemSearch}
  2838	                                                onActivate={handleActivateItem}
  2839	                                              />
  2840	                                            ) : (
  2841	                                              item.item_code && (
  2842	                                                <div style={{
  2843	                                                  padding: '4px 10px',
  2844	                                                  background: 'white',
  2845	                                                  border: '1px solid #e2e8f0',
  2846	                                                  borderLeft: '4px solid var(--po-primary)',
  2847	                                                  borderRadius: '0.375rem',
  2848	                                                  boxSizing: 'border-box',
  2849	                                                  display: 'flex',
  2850	                                                  alignItems: 'center',
  2851	                                                  height: '36px'
  2852	                                                }}>
  2853	                                                  <div style={{ color: '#1e293b', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'center' }}>
  2854	                                                    {item.item_name || 'Unnamed Item'}
  2855	                                                  </div>
  2856	                                                </div>
  2857	                                              )
  2858	                                            )}
  2859	                                          </div>
  2860	                                        </div>
  2861	                                      </td>
  2862	                                    );
  2863	                                  case 'custom_box_qty':
  2864	                                    return (
  2865	                                      <td key={col.id} className="purchase-td">
  2866	                                        <div className="premium-cell-container">
  2867	                                          <div className="premium-cell-box" style={{ position: 'relative' }}>
  2868	                                            <input
  2869	                                              type="text"
  2870	                                              inputMode="decimal"
  2871	                                              name={item.use_box_entry ? "custom_box_qty" : "qty"}
  2872	                                              value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
  2873	                                              readOnly={isViewOnly || formData.docstatus !== 0}
  2874	                                              onChange={(e) => handleInputChange(e, idx)}
  2875	                                              onFocus={(e) => e.target.select()}
  2876	                                              onClick={(e) => e.target.select()}
  2877	                                              onKeyDown={handleNextFocus}
  2878	                                              className={`text-left pl-3 font-bold outline-none ${item.use_box_entry ? 'text-sky-600' : 'text-slate-800'}`}
  2879	                                              style={{ paddingRight: item.item_code ? '48px' : '0.5rem' }}
  2880	                                              title={item.use_box_entry ? "Number of Boxes" : "Quantity"}
  2881	                                            />
  2882	                                            {item.item_code && (
  2883	                                              <span
  2884	                                                className="absolute right-2 text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
  2885	                                                style={{
  2886	                                                  color: item.use_box_entry ? '#0284c7' : '#64748b',
  2887	                                                  backgroundColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
  2888	                                                  borderColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0',
  2889	                                                  lineHeight: 1
  2890	                                                }}
  2891	                                              >
  2892	                                                {item.use_box_entry ? 'BOXES' : 'NOS'}
  2893	                                              </span>
  2894	                                            )}
  2895	                                          </div>
  2896	                                        </div>
  2897	                                      </td>
  2898	                                    );
  2899	                                  case 'custom_pieces_per_box':
  2900	                                    return (
  2901	                                      <td key={col.id} className="purchase-td">
  2902	                                        <div className="premium-cell-container">
  2903	                                          <div className="premium-cell-box">
  2904	                                            {item.use_box_entry ? (
  2905	                                              <input
  2906	                                                type="text"
  2907	                                                inputMode="decimal"
  2908	                                                name="custom_pieces_per_box"
  2909	                                                value={item.custom_pieces_per_box || ''}
  2910	                                                readOnly={isViewOnly || formData.docstatus !== 0}
  2911	                                                onChange={(e) => handleInputChange(e, idx)}
  2912	                                                onFocus={(e) => e.target.select()}
  2913	                                                onClick={(e) => e.target.select()}
  2914	                                                onKeyDown={handleNextFocus}
  2915	                                                className="text-left pl-3"
  2916	                                                title="Pieces per Box"
  2917	                                              />
  2918	                                            ) : (
  2919	                                              <div className="premium-cell-readonly premium-cell-readonly-left pl-3"></div>
  2920	                                            )}
  2921	                                          </div>
  2922	                                        </div>
  2923	                                      </td>
  2924	                                    );
  2925	                                  case 'custom_box_price':
  2926	                                    return (
  2927	                                      <td key={col.id} className="purchase-td">
  2928	                                        <div className="premium-cell-container">
  2929	                                          <div className="premium-cell-box">
  2930	                                            {item.use_box_entry ? (
  2931	                                              isViewOnly ? (
  2932	                                                <div className="premium-cell-readonly premium-cell-readonly-right">{formatPrice(item.custom_box_price)}</div>
  2933	                                              ) : (
  2934	                                                <input
  2935	                                                  type="text"
  2936	                                                  inputMode="decimal"
  2937	                                                  name="custom_box_price"
  2938	                                                  value={item.custom_box_price || ''}
  2939	                                                  readOnly={formData.docstatus !== 0}
  2940	                                                  onChange={(e) => handleInputChange(e, idx)}
  2941	                                                  onFocus={(e) => e.target.select()}
  2942	                                                  onClick={(e) => e.target.select()}
  2943	                                                  onKeyDown={handleNextFocus}
  2944	                                                  className="text-right pr-3 font-bold"
  2945	                                                />
  2946	                                              )
  2947	                                            ) : (
  2948	                                              <div className="premium-cell-readonly premium-cell-readonly-center"></div>
  2949	                                            )}
  2950	                                          </div>
  2951	                                        </div>
  2952	                                      </td>
  2953	                                    );
  2954	                                  case 'custom_selling_price':
  2955	                                    return (
  2956	                                      <td key={col.id} className="purchase-td">
  2957	                                        <div className="premium-cell-container">
  2958	                                          <div className="premium-cell-box">
  2959	                                            {isViewOnly ? (
  2960	                                              <div className="premium-cell-readonly premium-cell-readonly-right !text-[var(--po-primary)]">{formatPrice(item.custom_selling_price)}</div>
  2961	                                            ) : (
  2962	                                              <input
  2963	                                                type="text"
  2964	                                                inputMode="decimal"
  2965	                                                name="custom_selling_price"
  2966	                                                value={item.custom_selling_price || ''}
  2967	                                                readOnly={formData.docstatus !== 0}
  2968	                                                onChange={(e) => handleInputChange(e, idx)}
  2969	                                                onFocus={(e) => e.target.select()}
  2970	                                                onClick={(e) => e.target.select()}
  2971	                                                onKeyDown={handleNextFocus}
  2972	                                                className="text-right pr-3 font-bold !text-[var(--po-primary)]"
  2973	                                              />
  2974	                                            )}
  2975	                                          </div>
  2976	                                        </div>
  2977	                                      </td>
  2978	                                    );
  2979	                                  case 'custom_ref_sl_no':
  2980	                                    return (
  2981	                                      <td key={col.id} className="purchase-td">
  2982	                                        <div className="premium-cell-container">
  2983	                                          <div className="premium-cell-box">
  2984	                                            <input
  2985	                                              type="text"
  2986	                                              name="custom_ref_sl_no"
  2987	                                              value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
  2988	                                              readOnly={isViewOnly || formData.docstatus !== 0}
  2989	                                              onChange={(e) => handleInputChange(e, idx)}
  2990	                                              onFocus={(e) => e.target.select()}
  2991	                                              onClick={(e) => e.target.select()}
  2992	                                              onKeyDown={handleNextFocus}
  2993	                                              placeholder={isViewOnly ? '' : 'Serial...'}
  2994	                                              className="text-center text-[10px] font-bold"
  2995	                                            />
  2996	                                          </div>
  2997	                                        </div>
  2998	                                      </td>
  2999	                                    );
  3000	                                  case 'qty':
  3001	                                    return (
  3002	                                      <td key={col.id} className="purchase-td">
  3003	                                        <div className="premium-cell-container">
  3004	                                          <div className="premium-cell-box" style={{ position: 'relative' }}>
  3005	                                            <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold" style={{ paddingRight: item.use_box_entry ? '42px' : '0.5rem' }}>{item.qty || 0}</div>
  3006	                                            {item.use_box_entry && (
  3007	                                              <span
  3008	                                                className="absolute right-2 text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
  3009	                                                style={{
  3010	                                                  color: '#64748b',
  3011	                                                  backgroundColor: '#f8fafc',
  3012	                                                  borderColor: '#e2e8f0',
  3013	                                                  lineHeight: 1
  3014	                                                }}
  3015	                                              >
  3016	                                                NOS
  3017	                                              </span>
  3018	                                            )}
  3019	                                          </div>
  3020	                                        </div>
  3021	                                      </td>
  3022	                                    );
  3023	                                  case 'uom':
  3024	                                    return (
  3025	                                      <td key={col.id} className="purchase-td">
  3026	                                        <div className="premium-cell-container">
  3027	                                          <div className="premium-cell-box">
  3028	                                            {!item.item_code || isViewOnly || formData.docstatus !== 0 ? (
  3029	                                              <div className="premium-cell-readonly premium-cell-readonly-center text-[10px] font-bold uppercase text-slate-700">
  3030	                                                {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
  3031	                                              </div>
  3032	                                            ) : (
  3033	                                              <select
  3034	                                                value={item.uom || item.stock_uom || ''}
  3035	                                                onChange={(e) => handleUOMChange(e.target.value, idx)}
  3036	                                                className="text-center text-[10px] font-bold text-slate-600 bg-white"
  3037	                                                title="Select Unit of Measure"
  3038	                                              >
  3039	                                                {(() => {
  3040	                                                  const uniqueUoms = [];
  3041	                                                  const seen = new Set();
  3042	                                                  const candidates = [];
  3043	
  3044	                                                  if (item.uom_list && Array.isArray(item.uom_list)) {
  3045	                                                    item.uom_list.forEach(u => {
  3046	                                                      if (u && u.uom) candidates.push(u.uom);
  3047	                                                    });
  3048	                                                  }
  3049	
  3050	                                                  candidates.push(item.stock_uom || 'Nos');
  3051	                                                  candidates.push(item.uom || 'Nos');
  3052	                                                  candidates.push('Nos');
  3053	                                                  candidates.push('Box');
  3054	
  3055	                                                  candidates.forEach(u => {
  3056	                                                    const norm = u.trim().toLowerCase();
  3057	                                                    let display = u.trim();
  3058	                                                    if (norm === 'box') display = 'Box';
  3059	                                                    else if (norm === 'nos') display = 'Nos';
  3060	
  3061	                                                    if (!seen.has(norm)) {
  3062	                                                      seen.add(norm);
  3063	                                                      uniqueUoms.push(display);
  3064	                                                    }
  3065	                                                  });
  3066	
  3067	                                                  return uniqueUoms.map(uomVal => (
  3068	                                                    <option key={uomVal} value={uomVal}>{uomVal}</option>
  3069	                                                  ));
  3070	                                                })()}
  3071	                                              </select>
  3072	                                            )}
  3073	                                          </div>
  3074	                                        </div>
  3075	                                      </td>
  3076	                                    );
  3077	                                  case 'rate':
  3078	                                    return (
  3079	                                      <td key={col.id} className="purchase-td">
  3080	                                        <div className="premium-cell-container">
  3081	                                          <div className="premium-cell-box">
  3082	                                            {isViewOnly && !isUpdateMode ? (
  3083	                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold">{formatPrice(item.rate)}</div>
  3084	                                            ) : (
  3085	                                              <input
  3086	                                                type="text"
  3087	                                                inputMode="decimal"
  3088	                                                name="rate"
  3089	                                                value={item.rate || ''}
  3090	                                                readOnly={!isUpdateMode && formData.docstatus !== 0}
  3091	                                                onChange={(e) => handleInputChange(e, idx)}
  3092	                                                onFocus={(e) => e.target.select()}
  3093	                                                onClick={(e) => e.target.select()}
  3094	                                                onKeyDown={handleNextFocus}
  3095	                                                className={`text-right pr-3 font-bold outline-none ${isUpdateMode ? 'bg-amber-50 ring-1 ring-amber-200 rounded px-1' : ''}`}
  3096	                                              />
  3097	                                            )}
  3098	                                          </div>
  3099	                                        </div>
  3100	                                      </td>
  3101	                                    );
  3102	                                  case 'amount':
  3103	                                    return (
  3104	                                      <td key={col.id} className="purchase-td">
  3105	                                        <div className="premium-cell-container">
  3106	                                          <div className="premium-cell-box">
  3107	                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-900 tabular-nums">{formatPrice(item.amount)}</div>
  3108	                                          </div>
  3109	                                        </div>
  3110	                                      </td>
  3111	                                    );
  3112	                                }
  3113	                              });
  3114	                            })()}
  3115	                            <td className="purchase-td text-center">
  3116	                              {!isViewOnly && formData.docstatus === 0 && (
  3117	                                <button type="button" onClick={() => removeItemRow(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
  3118	                              )}
  3119	                            </td>
  3120	                          </tr>
  3121	                        ))}
  3122	                      </tbody>
  3123	                    </table>
  3124	                  </div>
  3125	                </div>
  3126	              </div>
  3127	
  3128	              <div className="po-summary-row-container">
