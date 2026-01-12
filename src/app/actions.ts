'use server';

import { getSheet, getCachedRows, invalidateCache } from '@/lib/googleSheets';
import { GoogleSpreadsheetRow } from 'google-spreadsheet';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// ... (existing imports)

export async function login(prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    (await cookies()).set('auth_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    redirect('/dashboard');
  } else {
    return { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
}

export async function logout() {
  (await cookies()).delete('auth_session');
  redirect('/login');
}

// ... (rest of the file)

import { uploadToCloudinary } from '@/lib/cloudinary';

// ... (existing imports)

const stockSchema = z.object({
  name: z.string().min(1, 'ชื่อสินค้าจำเป็นต้องระบุ'),
  quantity: z.coerce.number().min(0, 'จำนวนต้องไม่ติดลบ'),
  unit: z.string().optional(),
  price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
  user: z.string().min(1, 'ชื่อผู้บันทึกจำเป็นต้องระบุ'),
  receipt: z.string().optional(),
});

// ==================== INGREDIENT REGISTRY ====================

const ingredientRegistrySchema = z.object({
  name: z.string().min(1, 'ชื่อวัตถุดิบจำเป็นต้องระบุ'),
  quantity: z.coerce.number().min(0, 'จำนวนต้องไม่ติดลบ'),
  unit: z.string().optional(),
  price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
  user: z.string().min(1, 'ชื่อผู้บันทึกจำเป็นต้องระบุ'),
});

const bulkIngredientRegistrySchema = z.object({
  items: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      return parsed;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON' });
      return z.NEVER;
    }
  }).pipe(z.array(ingredientRegistrySchema)),
});

export async function addMultipleRegisteredIngredients(prevState: unknown, formData: FormData) {
  const validatedFields = bulkIngredientRegistrySchema.safeParse({
    items: formData.get('items'),
  });

  if (!validatedFields.success) {
    return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };
  }

  const { items } = validatedFields.data;

  try {
    const sheet = await getSheet('IngredientRegistry', ['name', 'quantity', 'unit', 'price', 'user', 'date']);

    const newRows = items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || 'g',
      price: item.price,
      user: item.user,
      date: new Date().toISOString(),
    }));

    if (newRows.length > 0) {
      await sheet.addRows(newRows);
    }

    invalidateCache('IngredientRegistry');
    revalidatePath('/ingredients-registry');

    return { success: true, message: `ลงทะเบียนสำเร็จ ${newRows.length} รายการ` };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function registerIngredient(prevState: unknown, formData: FormData) {
  const validatedFields = ingredientRegistrySchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price: formData.get('price'),
    user: formData.get('user'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { name, quantity, unit, price, user } = validatedFields.data;

  try {
    const sheet = await getSheet('IngredientRegistry', ['name', 'quantity', 'unit', 'price', 'user', 'date']);

    await sheet.addRow({
      name,
      quantity,
      unit: unit || 'g',
      price,
      user,
      date: new Date().toISOString(),
    });

    invalidateCache('IngredientRegistry');
    revalidatePath('/ingredients-registry');
    return { success: true, message: 'ลงทะเบียนวัตถุดิบเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function getRegisteredIngredients() {
  try {
    const rows = await getCachedRows('IngredientRegistry', ['name', 'quantity', 'unit', 'price', 'user', 'date']);
    return rows.map((row: GoogleSpreadsheetRow, index: number) => ({
      rowIndex: index,
      name: row.get('name') as string,
      quantity: Number(row.get('quantity')),
      unit: row.get('unit') as string,
      price: Number(row.get('price')),
      user: row.get('user') as string,
      date: row.get('date') as string,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Failed to fetch registered ingredients:', error);
    return [];
  }
}

export async function updateRegisteredIngredient(prevState: unknown, formData: FormData) {
  const originalDate = formData.get('originalDate') as string;
  const originalName = formData.get('originalName') as string;

  const validatedFields = ingredientRegistrySchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price: formData.get('price'),
    user: formData.get('user'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  const { name, quantity, unit, price, user } = validatedFields.data;

  try {
    const sheet = await getSheet('IngredientRegistry', ['name', 'quantity', 'unit', 'price', 'user', 'date']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(r => r.get('date') === originalDate && r.get('name') === originalName);

    if (!rowToUpdate) {
      return { message: 'ไม่พบวัตถุดิบที่ต้องการแก้ไข' };
    }

    rowToUpdate.set('name', name);
    rowToUpdate.set('quantity', quantity);
    rowToUpdate.set('unit', unit || 'g');
    rowToUpdate.set('price', price);
    rowToUpdate.set('user', user);
    await rowToUpdate.save();

    invalidateCache('IngredientRegistry');
    revalidatePath('/ingredients-registry');
    return { success: true, message: 'อัปเดตข้อมูลเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Update Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' };
  }
}

export async function deleteRegisteredIngredient(date: string, name: string) {
  try {
    const sheet = await getSheet('IngredientRegistry', ['name', 'quantity', 'unit', 'price', 'user', 'date']);
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('date') === date && r.get('name') === name);

    if (rowToDelete) {
      await rowToDelete.delete();
      invalidateCache('IngredientRegistry');
      revalidatePath('/ingredients-registry');
    }
    return { success: true, message: 'ลบรายการเรียบร้อยแล้ว' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}


export async function addStockItem(prevState: unknown, formData: FormData) {
  // Check for file
  const file = formData.get('file') as File | null;
  let receiptLink = '';

  if (file && file.size > 0) {
    try {
      const url = await uploadToCloudinary(file);
      receiptLink = url;
    } catch (error) {
      console.error("Upload failed", error);
      // Continue without receipt or return error? Let's continue but warn.
    }
  }

  const validatedFields = stockSchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price: formData.get('price'),
    user: formData.get('user'),
    receipt: receiptLink,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน ไม่สามารถเพิ่มสต็อกได้',
    };
  }

  const { name, quantity, unit, price, user, receipt } = validatedFields.data;

  try {
    const sheet = await getSheet('Stock', ['name', 'quantity', 'unit', 'price', 'user', 'date', 'receipt']);
    await sheet.addRow({
      name,
      quantity,
      unit: unit || 'g',
      price,
      user,
      date: new Date().toISOString(),
      receipt: receipt || '',
    });

    invalidateCache('Stock'); // Invalidate cache
    revalidatePath('/stock');
    return { message: 'เพิ่มสต็อกเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}


const bulkStockSchema = z.object({
  items: z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) throw new Error('Must be an array');
      return parsed;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON' });
      return z.NEVER;
    }
  }).pipe(z.array(stockSchema.extend({ tempId: z.any().optional() }))), // Allow tempId in input
});

export async function addMultipleStockItems(prevState: unknown, formData: FormData) {
  const validatedFields = bulkStockSchema.safeParse({
    items: formData.get('items'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  const { items } = validatedFields.data;

  try {
    const sheet = await getSheet('Stock', ['name', 'quantity', 'unit', 'price', 'user', 'date', 'receipt']);
    const date = new Date().toISOString();

    // 0. Handle Batch File (if exists)
    const batchFile = formData.get('batch_file') as File | null;
    let batchReceiptUrl = '';

    if (batchFile && batchFile.size > 0) {
      try {
        batchReceiptUrl = await uploadToCloudinary(batchFile);
      } catch (e) {
        console.error('Failed to upload batch file', e);
      }
    }

    // Process uploads for each item
    const rowsToAdd = await Promise.all(items.map(async (item, index) => {
      let receiptLink = batchReceiptUrl; // Default to batch URL

      // Check if there is a specific file for this item (overrides batch?)
      // Or should it be specific file takes precedence? Yes.
      const file = formData.get(`file_${index}`) as File | null;

      if (file && file.size > 0) {
        try {
          const url = await uploadToCloudinary(file);
          receiptLink = url;
        } catch (e) {
          console.error(`Failed to upload file for item ${index}`, e);
        }
      }

      return {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || 'g',
        price: item.price,
        user: item.user,
        date,
        receipt: receiptLink
      };
    }));

    // Add all rows
    await sheet.addRows(rowsToAdd);

    invalidateCache('Stock');
    revalidatePath('/stock');
    return { success: true, message: 'บันทึกรายการสต็อกทั้งหมดเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function getStockItems() {
  try {
    const rows = await getCachedRows('Stock', ['name', 'quantity', 'unit', 'price', 'user', 'date', 'receipt']);
    // Sort by date desc and include row index
    return rows.map((row: GoogleSpreadsheetRow, index: number) => ({
      rowIndex: index,
      name: row.get('name') as string,
      quantity: Number(row.get('quantity')),
      unit: row.get('unit') as string || 'g',
      price: Number(row.get('price')),
      date: row.get('date') as string,
      user: row.get('user') as string,
      receipt: row.get('receipt') as string | undefined,
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Failed to fetch stock items:', error);
    return [];
  }
}

export async function updateStockItem(prevState: unknown, formData: FormData) {
  const originalDate = formData.get('originalDate') as string;
  const originalName = formData.get('originalName') as string;
  const originalUser = formData.get('originalUser') as string;

  const file = formData.get('file') as File | null;
  let receiptLink = formData.get('existingReceipt') as string || '';

  if (file && file.size > 0) {
    try {
      const url = await uploadToCloudinary(file);
      receiptLink = url;
    } catch (error) {
      console.error("Upload failed", error);
    }
  }

  const validatedFields = stockSchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price: formData.get('price'),
    user: formData.get('user'),
    receipt: receiptLink,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล',
    };
  }

  const { name, quantity, unit, price, user, receipt } = validatedFields.data;

  try {
    const sheet = await getSheet('Stock', ['name', 'quantity', 'unit', 'price', 'user', 'date', 'receipt']);
    const rows = await sheet.getRows();

    // Find the row to update by matching original data
    const rowToUpdate = rows.find((row: GoogleSpreadsheetRow) =>
      row.get('date') === originalDate &&
      row.get('name') === originalName &&
      row.get('user') === originalUser
    );

    if (!rowToUpdate) {
      return { message: 'ไม่พบรายการที่ต้องการแก้ไข' };
    }

    // Update the row
    rowToUpdate.set('name', name);
    rowToUpdate.set('quantity', quantity);
    rowToUpdate.set('unit', unit || 'g');
    rowToUpdate.set('price', price);
    rowToUpdate.set('user', user);
    rowToUpdate.set('receipt', receipt);

    await rowToUpdate.save();

    invalidateCache('Stock');
    revalidatePath('/stock');
    return { success: true, message: 'อัพเดทรายการเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' };
  }
}

export async function getStockNames() {
  try {
    const rows = await getCachedRows('Stock', ['name']);
    const names = new Set(rows.map((row: GoogleSpreadsheetRow) => row.get('name')));
    return Array.from(names).filter(Boolean).sort();
  } catch (error) {
    console.error('Failed to fetch stock names:', error);
    return [];
  }
}

const menuSchema = z.object({
  name: z.string().min(1, 'ชื่อเมนูจำเป็นต้องระบุ'),
  price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
  ingredients: z.string().min(1, 'วัตถุดิบจำเป็นต้องระบุ'),
});

export async function addMenuItem(prevState: unknown, formData: FormData) {
  const validatedFields = menuSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price'),
    ingredients: formData.get('ingredients'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน ไม่สามารถเพิ่มเมนูได้',
    };
  }

  const { name, price, ingredients } = validatedFields.data;

  try {
    const sheet = await getSheet('Menu', ['name', 'price', 'ingredients', 'date']);
    await sheet.addRow({
      name,
      price,
      ingredients,
      date: new Date().toISOString(),
    });

    invalidateCache('Menu'); // Invalidate cache
    revalidatePath('/menu');
    return { message: 'เพิ่มเมนูเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function updateMenuItem(prevState: unknown, formData: FormData) {
  const originalName = formData.get('originalName') as string;
  const validatedFields = menuSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price'),
    ingredients: formData.get('ingredients'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน ไม่สามารถแก้ไขเมนูได้',
    };
  }

  const { name, price, ingredients } = validatedFields.data;

  try {
    const sheet = await getSheet('Menu', ['name', 'price', 'ingredients', 'date']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(row => row.get('name') === originalName);

    if (rowToUpdate) {
      rowToUpdate.set('name', name);
      rowToUpdate.set('price', String(price));
      rowToUpdate.set('ingredients', ingredients);
      // Optional: Update date? rowToUpdate.set('date', new Date().toISOString());

      await rowToUpdate.save();

      invalidateCache('Menu');
      revalidatePath('/menu');
      return { success: true, message: 'แก้ไขเมนูเรียบร้อยแล้ว!' };
    }

    return { success: false, message: 'ไม่พบเมนูที่ต้องการแก้ไข' };
  } catch (error) {
    console.error('Update Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไข' };
  }
}

export async function saveMenuItem(prevState: unknown, formData: FormData) {
  if (formData.get('originalName')) {
    return updateMenuItem(prevState, formData);
  } else {
    return addMenuItem(prevState, formData);
  }
}

export async function deleteMenuItem(name: string) {
  try {
    const sheet = await getSheet('Menu', ['name', 'price', 'ingredients', 'date']);
    const rows = await sheet.getRows(); // Need fresh rows for delete
    const rowToDelete = rows.find(row => row.get('name') === name);

    if (rowToDelete) {
      await rowToDelete.delete();
      invalidateCache('Menu'); // Invalidate cache
      revalidatePath('/menu');
      return { success: true, message: 'ลบเมนูเรียบร้อยแล้ว' };
    }
    return { success: false, message: 'ไม่พบเมนูที่ต้องการลบ' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

export async function getMenuItems() {
  try {
    const rows = await getCachedRows('Menu', ['name', 'price', 'ingredients', 'date']);
    return rows.map((row: GoogleSpreadsheetRow) => {
      const ingredientsRaw = row.get('ingredients');
      let ingredients = [];
      try {
        ingredients = ingredientsRaw ? JSON.parse(ingredientsRaw) : [];
      } catch {
        console.warn(`Failed to parse ingredients for menu item ${row.get('name')}:`, ingredientsRaw);
      }
      return {
        name: row.get('name'),
        price: Number(row.get('price')),
        ingredients,
      };
    });
  } catch (error) {
    console.error('Failed to fetch menu items:', error);
    return [];
  }
}

interface RegisteredIngredient {
  rowIndex?: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  user: string;
  date: string;
}

export async function submitOrder(orderItems: { name: string, price: number, quantity: number }[], posId: string = 'POS1') {
  try {
    const registry = await getRegisteredIngredients();
    const menuItems = await getMenuItems();

    let totalCost = 0;
    let totalPrice = 0;

    // Create a map for latest cost per gram: name -> price/quantity
    const costMap = registry.reduce((acc: Record<string, number>, item: RegisteredIngredient) => {
      const regItem = item;
      // Since registry is sorted by date desc, the first one we see is the latest
      if (!acc[regItem.name]) {
        acc[regItem.name] = regItem.price / regItem.quantity;
      }
      return acc;
    }, {});

    // Calculate cost and price
    for (const orderItem of orderItems) {
      const menuItem = menuItems.find(m => m.name === orderItem.name);
      if (!menuItem) continue;

      totalPrice += orderItem.price * orderItem.quantity;

      // Calculate cost based on ingredients
      let itemCost = 0;
      if (menuItem.ingredients) {
        for (const ing of menuItem.ingredients) {
          const pricePerUnit = costMap[ing.name] || 0;
          itemCost += pricePerUnit * ing.qty;
        }
      }
      totalCost += itemCost * orderItem.quantity;
    }

    // Determine sheet name based on POS ID
    let sheetName = 'OrdersPos1';
    if (posId === 'POS2') sheetName = 'OrdersPos2';
    if (posId === 'POS3') sheetName = 'OrdersPos3';

    const sheet = await getSheet(sheetName, ['items', 'totalPrice', 'totalCost', 'date']);
    await sheet.addRow({
      items: JSON.stringify(orderItems),
      totalPrice,
      totalCost,
      date: new Date().toISOString(),
    });

    invalidateCache(sheetName);
    revalidatePath('/dashboard');
    return { success: true, message: `บันทึกออเดอร์ (${posId}) เรียบร้อยแล้ว!` };
  } catch (error) {
    console.error('Order Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกออเดอร์' };
  }
}


// ==================== EXPENSE MANAGEMENT ====================

const expenseEventSchema = z.object({
  name: z.string().min(1, 'ชื่องานจำเป็นต้องระบุ'),
  date: z.string().min(1, 'วันที่จำเป็นต้องระบุ'),
  income: z.coerce.number().min(0, 'รายรับต้องไม่ติดลบ').optional(),
});

const expenseItemSchema = z.object({
  eventId: z.string().min(1, 'Event ID จำเป็นต้องระบุ'),
  itemName: z.string().min(1, 'ชื่อรายการจำเป็นต้องระบุ'),
  quantity: z.coerce.number().min(0, 'จำนวนต้องไม่ติดลบ'),
  unit: z.string().min(1, 'หน่วยจำเป็นต้องระบุ'),
  unitCost: z.coerce.number().min(0, 'ต้นทุนต้องไม่ติดลบ'),
  totalCost: z.coerce.number().min(0, 'ราคารวมต้องไม่ติดลบ'),
  notes: z.string().optional(),
});

// Create a new expense event
export async function createExpenseEvent(prevState: unknown, formData: FormData) {
  const validatedFields = expenseEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
    income: formData.get('income'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { name, date, income } = validatedFields.data;
  const eventId = `EVT-${Date.now()}`;

  try {
    const sheet = await getSheet('ExpenseEvents', ['eventId', 'name', 'date', 'income', 'createdAt']);
    await sheet.addRow({
      eventId,
      name,
      date,
      income: income || 0,
      createdAt: new Date().toISOString(),
    });

    invalidateCache('ExpenseEvents');
    revalidatePath('/expense');
    return { success: true, message: 'สร้างงานใหม่เรียบร้อยแล้ว!', eventId };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Get all expense events
export async function getExpenseEvents() {
  try {
    const rows = await getCachedRows('ExpenseEvents', ['eventId', 'name', 'date', 'income', 'createdAt']);
    return rows.map((row: GoogleSpreadsheetRow) => ({
      eventId: row.get('eventId') as string,
      name: row.get('name') as string,
      date: row.get('date') as string,
      income: Number(row.get('income')) || 0,
      createdAt: row.get('createdAt') as string,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Failed to fetch expense events:', error);
    return [];
  }
}

// Update expense event
export async function updateExpenseEvent(prevState: unknown, formData: FormData) {
  const eventId = formData.get('eventId') as string;
  const validatedFields = expenseEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
    income: formData.get('income'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { name, date, income } = validatedFields.data;

  try {
    const sheet = await getSheet('ExpenseEvents', ['eventId', 'name', 'date', 'income', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    if (!rowToUpdate) {
      return { message: 'ไม่พบงานที่ต้องการแก้ไข' };
    }

    rowToUpdate.set('name', name);
    rowToUpdate.set('date', date);
    rowToUpdate.set('income', income || 0);
    await rowToUpdate.save();

    invalidateCache('ExpenseEvents');
    revalidatePath('/expense');
    return { success: true, message: 'อัพเดทงานเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' };
  }
}

// Delete expense event
export async function deleteExpenseEvent(eventId: string) {
  try {
    // Delete all items for this event first
    const itemsSheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'createdAt']);
    const itemRows = await itemsSheet.getRows();
    const itemsToDelete = itemRows.filter((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    for (const row of itemsToDelete) {
      await row.delete();
    }

    // Then delete the event
    const eventsSheet = await getSheet('ExpenseEvents', ['eventId', 'name', 'date', 'income', 'createdAt']);
    const eventRows = await eventsSheet.getRows();
    const eventToDelete = eventRows.find((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    if (eventToDelete) {
      await eventToDelete.delete();
    }

    invalidateCache('ExpenseEvents');
    invalidateCache('ExpenseItems');
    revalidatePath('/expense');
    return { success: true, message: 'ลบงานและรายการค่าใช้จ่ายเรียบร้อยแล้ว' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

// Add expense item to an event
export async function addExpenseItem(prevState: unknown, formData: FormData) {
  const validatedFields = expenseItemSchema.safeParse({
    eventId: formData.get('eventId'),
    itemName: formData.get('itemName'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    unitCost: formData.get('unitCost'),
    totalCost: formData.get('totalCost'),
    notes: formData.get('notes'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { eventId, itemName, quantity, unit, unitCost, totalCost, notes } = validatedFields.data;
  const id = `ITEM-${Date.now()}`;

  try {
    const sheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'createdAt']);
    await sheet.addRow({
      id,
      eventId,
      itemName,
      quantity,
      unit,
      unitCost,
      totalCost,
      notes: notes || '',
      createdAt: new Date().toISOString(),
    });

    invalidateCache('ExpenseItems');
    revalidatePath('/expense');
    return { success: true, message: 'เพิ่มรายการค่าใช้จ่ายเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Add single expense item with receipt
export async function addExpenseItemWithReceipt(prevState: unknown, formData: FormData) {
  const eventId = formData.get('eventId') as string;
  const itemName = formData.get('itemName') as string;
  const quantity = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const unitCost = formData.get('unitCost') as string;
  const totalCost = formData.get('totalCost') as string;
  const notes = formData.get('notes') as string;
  const file = formData.get('file') as File | null;

  if (!eventId || !itemName || !quantity || !unitCost) {
    return { message: 'ข้อมูลไม่ครบถ้วน' };
  }

  let receiptLink = '';

  // Upload file to Cloudinary (same as Stock)
  if (file && file.size > 0) {
    try {
      console.log('Uploading file to Cloudinary:', file.name, file.size);
      const url = await uploadToCloudinary(file);
      receiptLink = url;
      console.log('Upload successful:', url);
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      return { success: false, message: 'อัปโหลดรูปสลิปไม่สำเร็จ กรุณาลองใหม่' };
    }
  }

  const id = `ITEM-${Date.now()}`;

  try {
    const sheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'receipt', 'createdAt']);
    await sheet.addRow({
      id,
      eventId,
      itemName,
      quantity: parseFloat(quantity),
      unit,
      unitCost: parseFloat(unitCost),
      totalCost: parseFloat(totalCost) || parseFloat(quantity) * parseFloat(unitCost),
      notes: notes || '',
      receipt: receiptLink,
      createdAt: new Date().toISOString(),
    });

    invalidateCache('ExpenseItems');
    revalidatePath('/expense');

    const msg = receiptLink
      ? 'บันทึกรายการพร้อมสลิปเรียบร้อยแล้ว!'
      : 'บันทึกรายการเรียบร้อยแล้ว!';
    return { success: true, message: msg };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Add multiple expense items at once
export async function addMultipleExpenseItems(eventId: string, items: Array<{
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes?: string;
  receipt?: string;
}>) {
  try {
    const sheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'receipt', 'createdAt']);
    const createdAt = new Date().toISOString();

    const rowsToAdd = items.map((item, index) => ({
      id: `ITEM-${Date.now()}-${index}`,
      eventId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      notes: item.notes || '',
      receipt: item.receipt || '',
      createdAt,
    }));

    await sheet.addRows(rowsToAdd);

    invalidateCache('ExpenseItems');
    revalidatePath('/expense');
    return { success: true, message: 'บันทึกรายการค่าใช้จ่ายทั้งหมดเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Get expense items for an event
export async function getExpenseItems(eventId: string) {
  try {
    const rows = await getCachedRows('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'receipt', 'createdAt']);
    return rows
      .filter((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId)
      .map((row: GoogleSpreadsheetRow) => ({
        id: row.get('id') as string,
        eventId: row.get('eventId') as string,
        itemName: row.get('itemName') as string,
        quantity: Number(row.get('quantity')),
        unit: row.get('unit') as string,
        unitCost: Number(row.get('unitCost')),
        totalCost: Number(row.get('totalCost')),
        notes: row.get('notes') as string,
        receipt: row.get('receipt') as string,
        createdAt: row.get('createdAt') as string,
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    console.error('Failed to fetch expense items:', error);
    return [];
  }
}

// Update expense item
export async function updateExpenseItem(prevState: unknown, formData: FormData) {
  const id = formData.get('id') as string;
  const itemName = formData.get('itemName') as string;
  const quantity = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const unitCost = formData.get('unitCost') as string;
  const totalCost = formData.get('totalCost') as string;
  const notes = formData.get('notes') as string;
  const existingReceipt = formData.get('existingReceipt') as string;
  const file = formData.get('file') as File | null;

  if (!id || !itemName || !quantity || !unitCost) {
    return { message: 'ข้อมูลไม่ครบถ้วน' };
  }

  let receiptLink = existingReceipt || '';
  if (file && file.size > 0) {
    try {
      const url = await uploadToCloudinary(file);
      receiptLink = url;
    } catch (error) {
      console.error('Upload failed', error);
    }
  }

  try {
    const sheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'receipt', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find((row: GoogleSpreadsheetRow) => row.get('id') === id);

    if (!rowToUpdate) {
      return { message: 'ไม่พบรายการที่ต้องการแก้ไข' };
    }

    rowToUpdate.set('itemName', itemName);
    rowToUpdate.set('quantity', parseFloat(quantity));
    rowToUpdate.set('unit', unit);
    rowToUpdate.set('unitCost', parseFloat(unitCost));
    rowToUpdate.set('totalCost', parseFloat(totalCost));
    rowToUpdate.set('notes', notes || '');
    rowToUpdate.set('receipt', receiptLink);
    await rowToUpdate.save();

    invalidateCache('ExpenseItems');
    revalidatePath('/expense');
    return { success: true, message: 'อัพเดทรายการเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' };
  }
}

// Delete expense item
export async function deleteExpenseItem(id: string) {
  try {
    const sheet = await getSheet('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToDelete = rows.find((row: GoogleSpreadsheetRow) => row.get('id') === id);

    if (rowToDelete) {
      await rowToDelete.delete();
      invalidateCache('ExpenseItems');
      revalidatePath('/expense');
      return { success: true, message: 'ลบรายการเรียบร้อยแล้ว' };
    }
    return { success: false, message: 'ไม่พบรายการที่ต้องการลบ' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

// Get expense summary for an event
export async function getExpenseSummary(eventId: string) {
  try {
    const events = await getExpenseEvents();
    const event = events.find(e => e.eventId === eventId);
    const items = await getExpenseItems(eventId);

    if (!event) {
      return null;
    }

    const totalExpense = items.reduce((sum, item) => sum + item.totalCost, 0);
    const profit = event.income - totalExpense;

    return {
      event,
      items,
      totalExpense,
      income: event.income,
      profit,
    };
  } catch (error) {
    console.error('Failed to get expense summary:', error);
    return null;
  }
}

// ==================== INCOME MANAGEMENT ====================

const incomeEventSchema = z.object({
  name: z.string().min(1, 'ชื่องานจำเป็นต้องระบุ'),
  date: z.string().min(1, 'วันที่จำเป็นต้องระบุ'),
});

// Create a new income event
export async function createIncomeEvent(prevState: unknown, formData: FormData) {
  const validatedFields = incomeEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { name, date } = validatedFields.data;
  const eventId = `INC-${Date.now()}`;

  try {
    const sheet = await getSheet('IncomeEvents', ['eventId', 'name', 'date', 'createdAt']);
    await sheet.addRow({
      eventId,
      name,
      date,
      createdAt: new Date().toISOString(),
    });

    invalidateCache('IncomeEvents');
    revalidatePath('/income');
    return { success: true, message: 'สร้างงานใหม่เรียบร้อยแล้ว!', eventId };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Get all income events
export async function getIncomeEvents() {
  try {
    const rows = await getCachedRows('IncomeEvents', ['eventId', 'name', 'date', 'createdAt']);
    return rows.map((row: GoogleSpreadsheetRow) => ({
      eventId: row.get('eventId') as string,
      name: row.get('name') as string,
      date: row.get('date') as string,
      createdAt: row.get('createdAt') as string,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Failed to fetch income events:', error);
    return [];
  }
}

// Update income event
export async function updateIncomeEvent(prevState: unknown, formData: FormData) {
  const eventId = formData.get('eventId') as string;
  const validatedFields = incomeEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ครบถ้วน',
    };
  }

  const { name, date } = validatedFields.data;

  try {
    const sheet = await getSheet('IncomeEvents', ['eventId', 'name', 'date', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    if (!rowToUpdate) {
      return { message: 'ไม่พบงานที่ต้องการแก้ไข' };
    }

    rowToUpdate.set('name', name);
    rowToUpdate.set('date', date);
    await rowToUpdate.save();

    invalidateCache('IncomeEvents');
    revalidatePath('/income');
    return { success: true, message: 'อัพเดทงานเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' };
  }
}

// Delete income event
export async function deleteIncomeEvent(eventId: string) {
  try {
    // Delete all items for this event first
    const itemsSheet = await getSheet('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    const itemRows = await itemsSheet.getRows();
    const itemsToDelete = itemRows.filter((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    for (const row of itemsToDelete) {
      await row.delete();
    }

    // Then delete the event
    const eventsSheet = await getSheet('IncomeEvents', ['eventId', 'name', 'date', 'createdAt']);
    const eventRows = await eventsSheet.getRows();
    const eventToDelete = eventRows.find((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId);

    if (eventToDelete) {
      await eventToDelete.delete();
    }

    invalidateCache('IncomeEvents');
    invalidateCache('IncomeItems');
    revalidatePath('/income');
    return { success: true, message: 'ลบงานและรายการรายรับเรียบร้อยแล้ว' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

// Add single income item with receipt
export async function addIncomeItemWithReceipt(prevState: unknown, formData: FormData) {
  const eventId = formData.get('eventId') as string;
  const itemName = formData.get('itemName') as string;
  const quantity = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const unitPrice = formData.get('unitPrice') as string;
  const totalPrice = formData.get('totalPrice') as string;
  const notes = formData.get('notes') as string;
  const file = formData.get('file') as File | null;

  if (!eventId || !itemName || !quantity || !unitPrice) {
    return { message: 'ข้อมูลไม่ครบถ้วน' };
  }

  let receiptLink = '';

  // Upload file to Cloudinary (same as Stock)
  if (file && file.size > 0) {
    try {
      console.log('Uploading file to Cloudinary:', file.name, file.size);
      const url = await uploadToCloudinary(file);
      receiptLink = url;
      console.log('Upload successful:', url);
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      return { success: false, message: 'อัปโหลดรูปสลิปไม่สำเร็จ กรุณาลองใหม่' };
    }
  }

  const id = `INC-ITEM-${Date.now()}`;

  try {
    const sheet = await getSheet('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    await sheet.addRow({
      id,
      eventId,
      itemName,
      quantity: parseFloat(quantity),
      unit,
      unitPrice: parseFloat(unitPrice),
      totalPrice: parseFloat(totalPrice) || parseFloat(quantity) * parseFloat(unitPrice),
      notes: notes || '',
      receipt: receiptLink,
      createdAt: new Date().toISOString(),
    });

    invalidateCache('IncomeItems');
    revalidatePath('/income');

    const msg = receiptLink
      ? 'บันทึกรายการพร้อมสลิปเรียบร้อยแล้ว!'
      : 'บันทึกรายการเรียบร้อยแล้ว!';
    return { success: true, message: msg };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

// Get income items for an event
export async function getIncomeItems(eventId: string) {
  try {
    const rows = await getCachedRows('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    return rows
      .filter((row: GoogleSpreadsheetRow) => row.get('eventId') === eventId)
      .map((row: GoogleSpreadsheetRow) => ({
        id: row.get('id') as string,
        eventId: row.get('eventId') as string,
        itemName: row.get('itemName') as string,
        quantity: Number(row.get('quantity')),
        unit: row.get('unit') as string,
        unitPrice: Number(row.get('unitPrice')),
        totalPrice: Number(row.get('totalPrice')),
        notes: row.get('notes') as string,
        receipt: row.get('receipt') as string,
        createdAt: row.get('createdAt') as string,
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    console.error('Failed to fetch income items:', error);
    return [];
  }
}

// Update income item
export async function updateIncomeItem(prevState: unknown, formData: FormData) {
  const id = formData.get('id') as string;
  const itemName = formData.get('itemName') as string;
  const quantity = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const unitPrice = formData.get('unitPrice') as string;
  const totalPrice = formData.get('totalPrice') as string;
  const notes = formData.get('notes') as string;
  const existingReceipt = formData.get('existingReceipt') as string;
  const file = formData.get('file') as File | null;

  if (!id || !itemName || !quantity || !unitPrice) {
    return { message: 'ข้อมูลไม่ครบถ้วน' };
  }

  let receiptLink = existingReceipt || '';
  if (file && file.size > 0) {
    try {
      const url = await uploadToCloudinary(file);
      receiptLink = url;
    } catch (error) {
      console.error('Upload failed', error);
    }
  }

  try {
    const sheet = await getSheet('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find((row: GoogleSpreadsheetRow) => row.get('id') === id);

    if (!rowToUpdate) {
      return { message: 'ไม่พบรายการที่ต้องการแก้ไข' };
    }

    rowToUpdate.set('itemName', itemName);
    rowToUpdate.set('quantity', parseFloat(quantity));
    rowToUpdate.set('unit', unit);
    rowToUpdate.set('unitPrice', parseFloat(unitPrice));
    rowToUpdate.set('totalPrice', parseFloat(totalPrice));
    rowToUpdate.set('notes', notes || '');
    rowToUpdate.set('receipt', receiptLink);
    await rowToUpdate.save();

    invalidateCache('IncomeItems');
    revalidatePath('/income');
    return { success: true, message: 'อัพเดทรายการเรียบร้อยแล้ว!' };
  } catch (error) {
    console.error('Database Error:', error);
    return { message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล' };
  }
}

// Delete income item
export async function deleteIncomeItem(id: string) {
  try {
    const sheet = await getSheet('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    const rows = await sheet.getRows();
    const rowToDelete = rows.find((row: GoogleSpreadsheetRow) => row.get('id') === id);

    if (rowToDelete) {
      await rowToDelete.delete();
      invalidateCache('IncomeItems');
      revalidatePath('/income');
      return { success: true, message: 'ลบรายการเรียบร้อยแล้ว' };
    }
    return { success: false, message: 'ไม่พบรายการที่ต้องการลบ' };
  } catch (error) {
    console.error('Delete Error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

export async function getDashboardStats(
  filterType: 'all' | 'day' | 'month' | 'year' | 'custom' = 'month',
  dateValue?: string,
  startDate?: string,
  endDate?: string,
  posFilter: 'all' | 'POS1' | 'POS2' | 'POS3' = 'all'
) {
  try {
    // Use Cached Rows
    let rows: GoogleSpreadsheetRow[] = [];
    const headers = ['items', 'totalPrice', 'totalCost', 'date'];

    if (posFilter === 'all') {
      const [oldRows, rows1, rows2, rows3] = await Promise.all([
        getCachedRows('Orders', headers),
        getCachedRows('OrdersPos1', headers),
        getCachedRows('OrdersPos2', headers),
        getCachedRows('OrdersPos3', headers),
      ]);
      rows = [...oldRows, ...rows1, ...rows2, ...rows3];
    } else {
      let sheetName = 'OrdersPos1';
      if (posFilter === 'POS2') sheetName = 'OrdersPos2';
      if (posFilter === 'POS3') sheetName = 'OrdersPos3';
      
      // If user selects specific POS, we only load that POS sheet. 
      // Note: Historical 'Orders' sheet is not included here as it wasn't tagged with POS ID.
      rows = await getCachedRows(sheetName, headers);
    }
    
    const stockRows = await getCachedRows('Stock', ['name', 'quantity', 'price', 'user', 'date']);

    let totalSales = 0;
    let totalCost = 0; // Cost of goods sold (ingredients used)
    let totalStockExpenditure = 0; // Money spent on buying stock
    let totalIncome = 0; // Other income from Income page
    let totalExpense = 0; // Other expenses from Expense page
    const itemSales: Record<string, { quantity: number, sales: number }> = {};
    const orders: { date: string; items: { name: string; quantity: number; price: number }[]; totalPrice: number; totalCost: number }[] = [];

    // Helper to check if a date matches the filter
    const isDateInFilter = (dateStr: string) => {
      const rowDate = new Date(dateStr);
      if (filterType === 'day' && dateValue) {
        const rowDateStr = rowDate.toISOString().split('T')[0];
        return rowDateStr === dateValue;
      } else if (filterType === 'month' && dateValue) {
        const rowMonthStr = rowDate.toISOString().slice(0, 7);
        return rowMonthStr === dateValue;
      } else if (filterType === 'year' && dateValue) {
        const rowYearStr = rowDate.getFullYear().toString();
        return rowYearStr === dateValue;
      } else if (filterType === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return rowDate >= start && rowDate <= end;
      }
      return true; // 'all'
    };

    // Process Orders
    rows.forEach((row: GoogleSpreadsheetRow) => {
      if (isDateInFilter(row.get('date'))) {
        totalSales += Number(row.get('totalPrice'));
        totalCost += Number(row.get('totalCost'));

        const itemsRaw = row.get('items');
        let items = [];
        try {
          items = itemsRaw ? JSON.parse(itemsRaw) : [];
        } catch {
          console.warn('Failed to parse order items:', itemsRaw);
        }

        orders.push({
          date: row.get('date'),
          items,
          totalPrice: Number(row.get('totalPrice')),
          totalCost: Number(row.get('totalCost')),
        });

        items.forEach((item: { name: string; quantity: number; price: number }) => {
          if (!itemSales[item.name]) {
            itemSales[item.name] = { quantity: 0, sales: 0 };
          }
          itemSales[item.name].quantity += item.quantity;
          itemSales[item.name].sales += item.price * item.quantity;
        });
      }
    });

    // Process Stock Expenditure
    stockRows.forEach((row: GoogleSpreadsheetRow) => {
      if (isDateInFilter(row.get('date'))) {
        totalStockExpenditure += Number(row.get('price'));
      }
    });

    // Process Other Incomes and Expenses
    const incomeEventRows = await getCachedRows('IncomeEvents', ['eventId', 'name', 'date', 'createdAt']);
    const incomeItemRows = await getCachedRows('IncomeItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'notes', 'receipt', 'createdAt']);
    const expenseEventRows = await getCachedRows('ExpenseEvents', ['eventId', 'name', 'date', 'income', 'createdAt']);
    const expenseItemRows = await getCachedRows('ExpenseItems', ['id', 'eventId', 'itemName', 'quantity', 'unit', 'unitCost', 'totalCost', 'notes', 'receipt', 'createdAt']);

    // Map Event IDs to Dates
    const incomeEventDates: Record<string, string> = {};
    incomeEventRows.forEach(row => {
      incomeEventDates[row.get('eventId')] = row.get('date');
    });

    const expenseEventDates: Record<string, string> = {};
    expenseEventRows.forEach(row => {
      expenseEventDates[row.get('eventId')] = row.get('date');
    });

    // Sum Income Items
    incomeItemRows.forEach(row => {
      const eventId = row.get('eventId');
      const eventDate = incomeEventDates[eventId];
      if (eventDate && isDateInFilter(eventDate)) {
        totalIncome += Number(row.get('totalPrice')) || 0;
      }
    });

    // Sum Expense Items
    expenseItemRows.forEach(row => {
      const eventId = row.get('eventId');
      const eventDate = expenseEventDates[eventId];
      if (eventDate && isDateInFilter(eventDate)) {
        totalExpense += Number(row.get('totalCost')) || 0;
      }
    });

    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalSales,
      totalCost, // COGS
      grossProfit: totalSales - totalCost,
      totalStockExpenditure,
      netProfit: totalSales - totalStockExpenditure,
      totalIncome,
      totalExpense,
      itemSales,
      orders,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return {
      totalSales: 0,
      totalCost: 0,
      grossProfit: 0,
      totalStockExpenditure: 0,
      netProfit: 0,
      totalIncome: 0,
      totalExpense: 0,
      itemSales: {},
      orders: []
    };
  }
}
