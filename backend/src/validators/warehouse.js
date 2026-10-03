const { z } = require('zod');

// US-02: Register incoming batch
const createBatchSchema = z.object({
  productName: z.string().trim().min(1, 'Product name is required'),
  supplierId: z.string().trim().min(1, 'Supplier ID is required'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
  unit: z.string().trim().min(1, 'Unit is required').default('kg'),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'receivedAt must be in YYYY-MM-DD format'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiryDate must be in YYYY-MM-DD format'),
});

// US-03: Allocate batch to chamber
const createAllocationSchema = z.object({
  batchId: z.string().trim().min(1, 'Batch ID is required'),
  chamberId: z.string().trim().min(1, 'Chamber ID is required'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
});

// US-06: Request withdrawal
const createWithdrawalSchema = z.object({
  productName: z.string().trim().min(1, 'Product name is required'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
  unit: z.string().trim().min(1, 'Unit is required').default('kg'),
  notes: z.string().optional(),
});

// US-06: Approve / Reject withdrawal
const updateWithdrawalStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be APPROVED or REJECTED' }),
  }),
});

// US-05: Dispatch approved request using FIFO
const createDispatchSchema = z.object({
  withdrawalId: z.string().trim().min(1, 'Withdrawal ID is required'),
});

// US-05: Authorized FIFO override with reason
const createDispatchOverrideSchema = z.object({
  withdrawalId: z.string().trim().min(1, 'Withdrawal ID is required'),
  batchId: z.string().trim().min(1, 'Batch ID is required'),
  reason: z.string().trim().min(1, 'Override reason is required'),
});

// US-07: Calculate Rent Estimate
const calculateRentSchema = z.object({
  supplierId: z.string().trim().min(1, 'Supplier ID is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
});

// US-08: Record Payment
const createPaymentSchema = z.object({
  rentId: z.string().trim().min(1, 'Rent ID is required'),
  amountPaise: z.number().int('Amount must be an integer (paise)').positive('Amount must be positive'),
  method: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI'], {
    errorMap: () => ({ message: 'Method must be one of: BANK_TRANSFER, CASH, CHEQUE, UPI' }),
  }),
  reference: z.string().optional(),
  accountNumber: z.string().optional(),
});

// US-08: Correct Payment with reason
const updatePaymentSchema = z.object({
  amountPaise: z.number().int('Amount must be an integer (paise)').positive('Amount must be positive'),
  reason: z.string().trim().min(1, 'Correction reason is required'),
});

// US-09: Assign staff task
const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedTo: z.string().trim().min(1, 'Assigned user ID is required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be in YYYY-MM-DD format'),
});

// US-09: Update task status
const updateTaskStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be PENDING, IN_PROGRESS, or COMPLETED' }),
  }),
});

module.exports = {
  createBatchSchema,
  createAllocationSchema,
  createWithdrawalSchema,
  updateWithdrawalStatusSchema,
  createDispatchSchema,
  createDispatchOverrideSchema,
  calculateRentSchema,
  createPaymentSchema,
  updatePaymentSchema,
  createTaskSchema,
  updateTaskStatusSchema,
};
