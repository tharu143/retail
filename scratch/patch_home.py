import sys

path = '/home/kyledev/frappe-bench/Retail-POS-FE/src/Components/Headers/Home.jsx'
with open(path, 'r') as f:
    content = f.read()

# Define the start and end markers for the block we want to replace
start_marker = '            // BEGIN_STRICT_ONLINE_LOGIC'
end_marker = '            localStorage.setItem(\'last_item_sync_time\', finalSyncTime);\n            apiItems = await db.items.toArray();\n          } else {\n            apiItems = await db.items.toArray();\n          }'

# The new logic
new_logic = """            // Background: Update local cache for offline fallback
            db.items.bulkPut(results.map(item => ({
              id: item.name,
              name: item.item_name,
              image: item.image,
              group: (item.item_group || "others").toLowerCase(),
              price: item.price_list_rate || 0,
              actual_qty: item.actual_qty || 0,
              local_qty: item.actual_qty || 0,
              total_qty: item.total_qty || item.actual_qty || 0,
              warehouse_details: item.warehouse_details || [],
              barcodes: item.barcodes || [],
              modified: item.modified,
              custom_pieces_per_box: item.custom_pieces_per_box || 1
            }))).catch(e => console.error("Dexie background update failed", e));
            
            if (results.length > 0) {
              const newestModified = results.reduce((max, item) => 
                (item.modified > max ? item.modified : max), "");
              localStorage.setItem('last_item_sync_time', newestModified || new Date().toISOString());
            }
          }"""

if start_marker in content:
    # Find the block and replace it
    start_index = content.find(start_marker)
    # We need to find the end of the block that contains 'apiItems = await db.items.toArray();' etc.
    # To be safe, I'll search for the specific end pattern
    end_pattern = 'apiItems = await db.items.toArray();\n          }\n        } catch (fetchErr)'
    end_index = content.find(end_pattern)
    
    if end_index != -1:
        # We want to keep '} catch (fetchErr)'
        final_content = content[:start_index] + new_logic + content[end_index + len('apiItems = await db.items.toArray();\n          }'):]
        with open(path, 'w') as f:
            f.write(final_content)
        print("Successfully patched fetchItems")
    else:
        print("End marker not found")
else:
    print("Start marker not found")
