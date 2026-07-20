const fs = require('fs');

const file = 'src/components/client/StoreHub.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('uploadMultipleFiles')) {
  content = content.replace(
    "import { formatCurrency, formatDate } from '../../../lib/utils';",
    "import { formatCurrency, formatDate } from '../../../lib/utils';\nimport { uploadMultipleFiles } from '../../../lib/uploadHelper';"
  );
}

const oldCode = `      // Upload de imagens para o bucket 'gsa-store-images'
      const uploadedUrls: string[] = [];
      for (let i = 0; i < trocaImages.length; i++) {
        const file = trocaImages[i];
        const fileExt = file.name.split('.').pop();
        const fileName = \`\${clientId}/\${Date.now()}-\${i}.\${fileExt}\`;
        const filePath = \`trocas/\${fileName}\`;

        const { error: uploadError } = await supabase.storage
          .from('gsa-store-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gsa-store-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }`;

const newCode = `      // Upload de imagens isolado no Helper (Performance & DRY)
      const uploadedUrls = await uploadMultipleFiles(trocaImages, 'gsa-store-images', 'trocas', clientId || 'guest');`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(file, content);
console.log('Upload logic isolated.');
