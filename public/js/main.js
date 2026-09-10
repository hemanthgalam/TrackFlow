document.addEventListener('DOMContentLoaded', () => {
  // Update Date Display in header
  updateDateDisplay();

  // Initialize Toast System
  initToastContainer();

  // Initialize List Filters (Jobs page)
  initListFilters();

  // Initialize Kanban Drag & Drop
  initKanbanDragAndDrop();

  // Initialize Inline Dropdowns (Jobs page)
  initInlineDropdowns();
});

// Display current date formatted elegantly
function updateDateDisplay() {
  const dateEl = document.getElementById('current-date-display');
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }
}

// Toast Container Initialization
function initToastContainer() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

// Global Toast Messenger
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  if (type === 'info') icon = '<i class="fa-solid fa-circle-info"></i>';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  // Trigger entering animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Asynchronous Status Update Helper
async function updateJobStatusOnServer(jobId, newStatus, timelineNote) {
  try {
    const response = await fetch(`/jobs/${jobId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus, note: timelineNote })
    });

    if (!response.ok) {
      throw new Error('Failed to update status');
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error updating status:', err);
    showToast('Failed to save status change. Please refresh.', 'error');
    return null;
  }
}

// List Page: Search and Filter tables
function initListFilters() {
  const searchInput = document.getElementById('jobs-search-input');
  const statusFilter = document.getElementById('status-filter');
  const workplaceFilter = document.getElementById('workplace-filter');
  const table = document.getElementById('jobs-table');

  if (!table) return;

  const rows = table.querySelectorAll('.job-row');

  function filterTable() {
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusVal = statusFilter ? statusFilter.value : 'all';
    const workplaceVal = workplaceFilter ? workplaceFilter.value : 'all';

    let matchCount = 0;

    rows.forEach(row => {
      const searchData = row.getAttribute('data-searchable') || '';
      const statusData = row.getAttribute('data-status') || '';
      const workplaceData = row.getAttribute('data-workplace') || '';

      const searchMatch = searchVal === '' || searchData.includes(searchVal);
      const statusMatch = statusVal === 'all' || statusData === statusVal;
      const workplaceMatch = workplaceVal === 'all' || workplaceData === workplaceVal;

      if (searchMatch && statusMatch && workplaceMatch) {
        row.style.display = '';
        matchCount++;
      } else {
        row.style.display = 'none';
      }
    });

    // Check for empty results state
    const emptyMsgRow = table.querySelector('.empty-filter-row');
    if (matchCount === 0 && rows.length > 0) {
      if (!emptyMsgRow) {
        const tr = document.createElement('tr');
        tr.className = 'empty-filter-row';
        tr.innerHTML = `
          <td colspan="7">
            <div class="table-empty-state">
              <i class="fa-solid fa-folder-open"></i>
              <p>No job applications match your filters.</p>
            </div>
          </td>
        `;
        table.querySelector('tbody').appendChild(tr);
      }
    } else if (emptyMsgRow) {
      emptyMsgRow.remove();
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterTable);
  if (statusFilter) statusFilter.addEventListener('change', filterTable);
  if (workplaceFilter) workplaceFilter.addEventListener('change', filterTable);
}

// List Page: Inline status selection update
function initInlineDropdowns() {
  const dropdowns = document.querySelectorAll('.table-status-select');
  
  dropdowns.forEach(select => {
    select.addEventListener('change', async (e) => {
      const jobId = select.getAttribute('data-job-id');
      const newStatus = select.value;
      
      // Update badge class dynamically on select element
      select.className = 'status-change-dropdown table-status-select'; // reset
      select.classList.add(getStatusBadgeClass(newStatus));

      const note = `Status updated to ${newStatus} from the list view.`;
      const result = await updateJobStatusOnServer(jobId, newStatus, note);
      
      if (result) {
        // Update row data-status for client-side filtering consistency
        const row = select.closest('.job-row');
        if (row) row.setAttribute('data-status', newStatus);
        
        showToast(`Updated status to ${newStatus}!`, 'success');
      }
    });
  });
}

// Helper to match backend CSS badges in frontend
function getStatusBadgeClass(status) {
  switch (status.toLowerCase()) {
    case 'applied': return 'badge-applied';
    case 'interviewing': return 'badge-interviewing';
    case 'offered': return 'badge-offered';
    case 'accepted': return 'badge-accepted';
    case 'rejected': return 'badge-rejected';
    default: return 'badge-default';
  }
}

// Kanban Page: Card Drag & Drop
function initKanbanDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-column');

  if (columns.length === 0) return;

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  columns.forEach(column => {
    const container = column.querySelector('.kanban-cards-container');
    const targetStatus = column.getAttribute('data-status');

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragenter', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');

      const jobId = e.dataTransfer.getData('text/plain');
      const cardElement = document.getElementById(`job-card-${jobId}`);

      if (!cardElement) return;

      const sourceColumn = cardElement.closest('.kanban-column');
      const sourceStatus = sourceColumn.getAttribute('data-status');

      // If dropped in the same column, do nothing
      if (sourceStatus === targetStatus) return;

      // Optimistic UI updates
      container.appendChild(cardElement);

      // Check if source column is empty, hide empty state or add one
      checkColumnEmptyStates();

      // Trigger update API
      const note = `Moved application status from ${sourceStatus} to ${targetStatus} via Kanban board.`;
      const result = await updateJobStatusOnServer(jobId, targetStatus, note);

      if (result) {
        showToast(`${result.job.company} status changed to ${targetStatus}`, 'success');
        updateColumnCounts();
      } else {
        // Revert card back on failure
        const sourceContainer = sourceColumn.querySelector('.kanban-cards-container');
        sourceContainer.appendChild(cardElement);
        checkColumnEmptyStates();
        updateColumnCounts();
      }
    });
  });

  function checkColumnEmptyStates() {
    columns.forEach(column => {
      const container = column.querySelector('.kanban-cards-container');
      const cardCount = container.querySelectorAll('.kanban-card').length;
      let emptyMsg = container.querySelector('.column-empty-state');

      if (cardCount === 0) {
        if (!emptyMsg) {
          emptyMsg = document.createElement('div');
          emptyMsg.className = 'column-empty-state';
          emptyMsg.textContent = `No jobs in ${column.getAttribute('data-status')}`;
          container.appendChild(emptyMsg);
        }
      } else if (emptyMsg) {
        emptyMsg.remove();
      }
    });
  }

  function updateColumnCounts() {
    columns.forEach(column => {
      const container = column.querySelector('.kanban-cards-container');
      const count = container.querySelectorAll('.kanban-card').length;
      const badge = column.querySelector('.column-badge');
      if (badge) {
        badge.textContent = count;
      }
    });
  }
}
