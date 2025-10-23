# DynamoDB Reserved Keyword Fix

## Vấn đề đã được fix

### ❌ **DynamoDB ValidationException: "status" is a reserved keyword**

**Lỗi gốc:**
```
ValidationException: Invalid UpdateExpression: Attribute name is a reserved keyword; reserved keyword: status
```

**Nguyên nhân:**
- DynamoDB có các reserved keywords như `status`, `data`, `type`, etc.
- Khi sử dụng reserved keywords trong UpdateExpression, cần sử dụng ExpressionAttributeNames

## Giải pháp

### **Fix trong `sqs-worker/src/workers/transcodingWorker.js`:**

#### **Trước (Lỗi):**
```javascript
UpdateExpression: 'SET resolution_progress = :rp, progress = :p, status = :s, updated_at = :ua'
```

#### **Sau (Fixed):**
```javascript
UpdateExpression: 'SET resolution_progress = :rp, progress = :p, #status = :s, updated_at = :ua',
ExpressionAttributeNames: {
    '#status': 'status'
}
```

### **Chi tiết fix:**

```javascript
// Update job with new progress
const updateCommand = new UpdateCommand({
    TableName: this.tableName,
    Key: { 
        'qut-username': QUT_USERNAME,
        'sk': `VIDEO#${videoId}`
    },
    UpdateExpression: 'SET resolution_progress = :rp, progress = :p, #status = :s, updated_at = :ua',
    ExpressionAttributeNames: {
        '#status': 'status'  // Map #status to actual 'status' field
    },
    ExpressionAttributeValues: {
        ':rp': currentResolutionProgress,
        ':p': overallProgress,
        ':s': overallStatus,
        ':ua': new Date().toISOString()
    }
});
```

## Các reserved keywords khác cần chú ý

DynamoDB có nhiều reserved keywords, bao gồm:
- `status`
- `data`
- `type`
- `size`
- `count`
- `name`
- `value`
- `key`
- `timestamp`
- `date`
- `time`
- `id`
- `index`
- `order`
- `group`
- `class`
- `function`
- `method`
- `property`
- `attribute`
- `item`
- `object`
- `array`
- `list`
- `set`
- `map`
- `string`
- `number`
- `boolean`
- `null`
- `true`
- `false`
- `undefined`
- `void`
- `this`
- `super`
- `new`
- `delete`
- `return`
- `throw`
- `try`
- `catch`
- `finally`
- `if`
- `else`
- `while`
- `for`
- `do`
- `switch`
- `case`
- `default`
- `break`
- `continue`
- `with`
- `in`
- `of`
- `instanceof`
- `typeof`
- `void`
- `delete`
- `new`
- `this`
- `super`
- `return`
- `throw`
- `try`
- `catch`
- `finally`
- `if`
- `else`
- `while`
- `for`
- `do`
- `switch`
- `case`
- `default`
- `break`
- `continue`
- `with`
- `in`
- `of`
- `instanceof`
- `typeof`

## Cách sử dụng ExpressionAttributeNames

### **Pattern chung:**
```javascript
UpdateExpression: 'SET #fieldName = :value',
ExpressionAttributeNames: {
    '#fieldName': 'actual_field_name'
},
ExpressionAttributeValues: {
    ':value': actualValue
}
```

### **Ví dụ với multiple reserved keywords:**
```javascript
UpdateExpression: 'SET #status = :s, #data = :d, #type = :t',
ExpressionAttributeNames: {
    '#status': 'status',
    '#data': 'data', 
    '#type': 'type'
},
ExpressionAttributeValues: {
    ':s': statusValue,
    ':d': dataValue,
    ':t': typeValue
}
```

## Cách test fix

### 1. Rebuild sqs-worker:
```bash
# Windows
scripts/rebuild-dynamodb-fix.bat

# Linux/Mac
scripts/rebuild-dynamodb-fix.sh
```

### 2. Test DynamoDB fix:
```bash
node scripts/test-dynamodb-fix.js
```

### 3. Kiểm tra logs:
```bash
docker-compose logs -f sqs-worker
```

## Kết quả mong đợi

### ✅ **Trước fix:**
```
❌ Error updating resolution progress: ValidationException: Invalid UpdateExpression: Attribute name is a reserved keyword; reserved keyword: status
```

### ✅ **Sau fix:**
```
📊 Updated 1920x1080 progress: 45% (processing)
📊 Updated 1280x720 progress: 30% (processing)  
📊 Updated 854x480 progress: 15% (processing)
```

## Files được sửa

- `sqs-worker/src/workers/transcodingWorker.js` - Fix reserved keyword issue

## Scripts được tạo

- `scripts/test-dynamodb-fix.js` - Test DynamoDB fix
- `scripts/rebuild-dynamodb-fix.bat/.sh` - Rebuild scripts

## Monitoring

Để theo dõi DynamoDB updates:

1. **Check logs**: `docker-compose logs -f sqs-worker`
2. **Look for**: `📊 Updated {resolution} progress: {percent}% ({status})`
3. **No more errors**: Không còn ValidationException

## Best Practices

### **Khi sử dụng DynamoDB UpdateExpression:**

1. **Luôn sử dụng ExpressionAttributeNames** cho reserved keywords
2. **Test với các field names** trước khi deploy
3. **Sử dụng descriptive names** cho ExpressionAttributeNames
4. **Document reserved keywords** trong team

### **Ví dụ safe pattern:**
```javascript
// Safe approach for any field name
const fieldName = 'status'; // Could be any field name
const updateExpression = `SET #${fieldName} = :value`;
const expressionAttributeNames = {
    [`#${fieldName}`]: fieldName
};
```

Fix này đảm bảo DynamoDB updates hoạt động chính xác mà không gặp reserved keyword errors! 🎉
