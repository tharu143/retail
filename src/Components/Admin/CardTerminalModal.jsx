import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './CardTerminalModal.css';

export default function CardTerminalModal({ 
  isOpen, 
  onClose, 
  amount = 0, 
  posInvoice = null, 
  onPaymentSuccess 
}) {
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, PENDING, SUCCESS, DECLINED, TIMEOUT, ERROR
  const [statusMsg, setStatusMsg] = useState('');
  const [txnDetails, setTxnDetails] = useState(null);
  const [mockMode, setMockMode] = useState(true);
  const [cardNetwork, setCardNetwork] = useState('VISA');
  const [last4, setLast4] = useState('4242');

  useEffect(() => {
    if (isOpen && amount > 0) {
      initiatePayment();
    } else {
      resetState();
    }
  }, [isOpen, amount]);

  const resetState = () => {
    setRequestId(null);
    setStatus('IDLE');
    setStatusMsg('');
    setTxnDetails(null);
  };

  const initiatePayment = async () => {
    try {
      setStatus('PENDING');
      setStatusMsg('Sending request to Card Terminal...');
      
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.initiate_terminal_payment', {
        pos_invoice: posInvoice,
        amount: amount,
        card_type: 'Credit Card',
        mock_mode: mockMode
      });

      if (res.data?.message?.status === 'success') {
        const reqId = res.data.message.request_id;
        setRequestId(reqId);
        setStatusMsg('Please Swipe, Insert, or Tap Card on Machine...');
      } else {
        setStatus('ERROR');
        setStatusMsg(res.data?.message?.message || 'Failed to initiate terminal transaction.');
      }
    } catch (err) {
      setStatus('ERROR');
      setStatusMsg(err.message || 'Network error connecting to payment gateway.');
    }
  };

  // Dev Mock Hardware Simulator Trigger
  const triggerMockHardwareSwipe = async (action) => {
    if (!requestId) return;
    try {
      setStatusMsg(`Simulating hardware card ${action.toLowerCase()}...`);
      const res = await axios.post('/api/method/custom_retailpos.custom_pos_features.mock_swipe_action', {
        request_id: requestId,
        action: action,
        card_network: cardNetwork,
        last4: last4
      });

      if (res.data?.message?.status === 'success') {
        const data = res.data.message.data;
        setTxnDetails(data);
        if (action === 'SUCCESS') {
          setStatus('SUCCESS');
          setStatusMsg('Payment Approved! Transaction Slip Generated.');
        } else if (action === 'DECLINED') {
          setStatus('DECLINED');
          setStatusMsg(data.error_message || 'Card Payment Declined.');
        } else {
          setStatus('TIMEOUT');
          setStatusMsg('Terminal Session Timed Out.');
        }
      }
    } catch (err) {
      setStatus('ERROR');
      setStatusMsg(err.message || 'Error processing mock swipe.');
    }
  };

  const handlePrintSlip = () => {
    if (!txnDetails?.print_slip_text) return;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Card Payment Slip</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div>${txnDetails.print_slip_text}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="erp-overlay card-terminal-modal-overlay">
      <div className="erp-dialog card-terminal-modal-content">
        <div className="card-terminal-header">
          <h3>💳 Credit Card Terminal Payment</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="card-terminal-body">
          <div className="amount-display">
            <span className="label">Total Payable Amount</span>
            <span className="value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <DirhamIcon size={18} />{parseFloat(amount).toFixed(2)}
            </span>
          </div>

          <div className={`status-box status-${status.toLowerCase()}`}>
            {status === 'PENDING' && <div className="spinner"></div>}
            <div className="status-title">{status}</div>
            <p className="status-msg">{statusMsg}</p>
          </div>

          {/* Dev Mock Hardware Control Box */}
          <div className="mock-hardware-box">
            <div className="mock-title">⚙️ Dev Hardware Terminal Simulator</div>
            <p className="mock-desc">Simulate physical card swipe/tap without physical machine hardware:</p>
            
            <div className="mock-inputs">
              <select value={cardNetwork} onChange={(e) => setCardNetwork(e.target.value)}>
                <option value="VISA">VISA</option>
                <option value="MASTERCARD">MasterCard</option>
                <option value="RUPAY">RuPay</option>
                <option value="AMEX">Amex</option>
              </select>
              <input 
                type="text" 
                placeholder="Last 4 digits" 
                maxLength={4}
                value={last4} 
                onChange={(e) => setLast4(e.target.value)} 
              />
            </div>

            <div className="mock-action-btns">
              <button 
                className="btn-mock-success" 
                disabled={status !== 'PENDING'}
                onClick={() => triggerMockHardwareSwipe('SUCCESS')}
              >
                ✅ Simulate Swipe Approval
              </button>
              <button 
                className="btn-mock-decline" 
                disabled={status !== 'PENDING'}
                onClick={() => triggerMockHardwareSwipe('DECLINED')}
              >
                ❌ Simulate Decline
              </button>
              <button 
                className="btn-mock-timeout" 
                disabled={status !== 'PENDING'}
                onClick={() => triggerMockHardwareSwipe('TIMEOUT')}
              >
                ⏱️ Simulate Timeout
              </button>
            </div>
          </div>

          {txnDetails && status === 'SUCCESS' && (
            <div className="slip-preview-container">
              <h4>Card Authorization Metadata</h4>
              <div className="metadata-grid">
                <div><strong>RRN:</strong> {txnDetails.rrn}</div>
                <div><strong>Auth Code:</strong> {txnDetails.approval_code}</div>
                <div><strong>Card:</strong> {txnDetails.card_network} {txnDetails.masked_pan}</div>
              </div>
              <button className="btn-print-slip" onClick={handlePrintSlip}>
                🖨️ Print Card Slip
              </button>
            </div>
          )}
        </div>

        <div className="card-terminal-footer">
          {status === 'SUCCESS' ? (
            <button className="btn-done" onClick={() => { if (onPaymentSuccess && txnDetails) onPaymentSuccess(txnDetails); }}>
              Complete & Add Payment
            </button>
          ) : (
            <button className="btn-cancel" onClick={onClose}>Cancel Transaction</button>
          )}
        </div>
      </div>
    </div>
  );
}
