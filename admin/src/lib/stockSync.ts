import { supabase } from "@/lib/supabase";

export interface OrderItemToDeduct {
  name?: string;
  model?: string;
  flavor?: string;
  quantity: number;
}

/**
 * Deduz automaticamente a quantidade vendida de produtos do estoque na tabela 'smoking_products' do Supabase
 */
export async function deductStockForOrderItems(
  items: OrderItemToDeduct[]
): Promise<{ success: boolean; deductedCount: number; updatedProducts: string[] }> {
  if (!items || items.length === 0) {
    return { success: true, deductedCount: 0, updatedProducts: [] };
  }

  try {
    // 1. Busca todos os produtos do Supabase
    const { data: products, error } = await supabase
      .from("smoking_products")
      .select("id, name, brand, flavor, stock");

    if (error || !products) {
      console.warn("Não foi possível buscar produtos para dar baixa no estoque:", error);
      return { success: false, deductedCount: 0, updatedProducts: [] };
    }

    let deductedCount = 0;
    const updatedProducts: string[] = [];

    for (const item of items) {
      const qtyToDeduct = item.quantity || 1;
      const targetFlavor = (item.flavor || "").trim().toLowerCase();
      const targetName = (item.name || item.model || "").trim().toLowerCase();

      // Procura o produto correspondente no banco
      const match = products.find((p) => {
        const pFlavor = (p.flavor || "").trim().toLowerCase();
        const pName = (p.name || "").trim().toLowerCase();
        const pBrand = (p.brand || "").trim().toLowerCase();

        // 1. Match por sabor
        const flavorMatch =
          pFlavor === targetFlavor ||
          (targetFlavor && pFlavor.includes(targetFlavor)) ||
          (targetFlavor && targetFlavor.includes(pFlavor));

        // 2. Match por modelo/marca
        const modelMatch =
          !targetName ||
          pName.includes(targetName) ||
          pBrand.includes(targetName) ||
          targetName.includes(pName);

        return flavorMatch && modelMatch;
      });

      // Se encontrou match exato por sabor (ou primeiro produto com sabor correspondente)
      const targetProduct = match || products.find(p => (p.flavor || '').trim().toLowerCase() === targetFlavor);

      if (targetProduct) {
        const currentStock =
          typeof targetProduct.stock === "number"
            ? targetProduct.stock
            : parseInt(targetProduct.stock || "0");
        const newStock = Math.max(0, currentStock - qtyToDeduct);

        // Atualiza no Supabase
        const { error: updateError } = await supabase
          .from("smoking_products")
          .update({ stock: newStock })
          .eq("id", targetProduct.id);

        if (!updateError) {
          deductedCount += qtyToDeduct;
          const prodInfo = `${targetProduct.name} (${targetProduct.flavor}): ${currentStock} -> ${newStock} un`;
          updatedProducts.push(prodInfo);
          console.log(`✅ Baixa automática em estoque no Supabase: ${prodInfo}`);
        } else {
          console.warn(`Erro ao atualizar estoque para ${targetProduct.name}:`, updateError);
        }
      } else {
        console.warn(`⚠️ Produto não encontrado no estoque para dar baixa: ${targetName} - ${targetFlavor}`);
      }
    }

    return { success: true, deductedCount, updatedProducts };
  } catch (err) {
    console.error("Erro ao dar baixa automática no estoque:", err);
    return { success: false, deductedCount: 0, updatedProducts: [] };
  }
}

/**
 * Devolve/incrementa a quantidade no estoque da tabela 'smoking_products' no Supabase (Fallback/JS)
 */
export async function returnStockForOrderItems(
  items: OrderItemToDeduct[]
): Promise<{ success: boolean; returnedCount: number; updatedProducts: string[] }> {
  if (!items || items.length === 0) {
    return { success: true, returnedCount: 0, updatedProducts: [] };
  }

  try {
    const { data: products, error } = await supabase
      .from("smoking_products")
      .select("id, name, brand, flavor, stock");

    if (error || !products) {
      console.warn("Não foi possível buscar produtos para devolver ao estoque:", error);
      return { success: false, returnedCount: 0, updatedProducts: [] };
    }

    let returnedCount = 0;
    const updatedProducts: string[] = [];

    for (const item of items) {
      const qtyToReturn = item.quantity || 1;
      const targetFlavor = (item.flavor || "").trim().toLowerCase();
      const targetName = (item.name || item.model || "").trim().toLowerCase();

      // Procura o produto correspondente no banco
      const match = products.find((p) => {
        const pFlavor = (p.flavor || "").trim().toLowerCase();
        const pName = (p.name || "").trim().toLowerCase();
        const pBrand = (p.brand || "").trim().toLowerCase();

        const flavorMatch =
          pFlavor === targetFlavor ||
          (targetFlavor && pFlavor.includes(targetFlavor)) ||
          (targetFlavor && targetFlavor.includes(pFlavor));

        const modelMatch =
          !targetName ||
          pName.includes(targetName) ||
          pBrand.includes(targetName) ||
          targetName.includes(pName);

        return flavorMatch && modelMatch;
      });

      const targetProduct = match || products.find(p => (p.flavor || '').trim().toLowerCase() === targetFlavor);

      if (targetProduct) {
        const currentStock =
          typeof targetProduct.stock === "number"
            ? targetProduct.stock
            : parseInt(targetProduct.stock || "0");
        const newStock = currentStock + qtyToReturn;

        const { error: updateError } = await supabase
          .from("smoking_products")
          .update({ stock: newStock })
          .eq("id", targetProduct.id);

        if (!updateError) {
          returnedCount += qtyToReturn;
          const prodInfo = `${targetProduct.name} (${targetProduct.flavor}): ${currentStock} -> ${newStock} un`;
          updatedProducts.push(prodInfo);
          console.log(`✅ Devolução automática em estoque no Supabase: ${prodInfo}`);
        } else {
          console.warn(`Erro ao atualizar estoque para ${targetProduct.name}:`, updateError);
        }
      }
    }

    return { success: true, returnedCount, updatedProducts };
  } catch (err) {
    console.error("Erro ao devolver ao estoque:", err);
    return { success: false, returnedCount: 0, updatedProducts: [] };
  }
}
