const DB_NAME = 'first-mix-local-works';
const STORE = 'works';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export const saveWork = work => transact('readwrite', store => store.put(work));
export const deleteWork = id => transact('readwrite', store => store.delete(id));
export const getWorks = async () => (await transact('readonly', store => store.getAll())).sort((a,b) => b.createdAt-a.createdAt);
