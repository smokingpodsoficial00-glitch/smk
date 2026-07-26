export interface Product {
  id: string;
  name: string;
  brand: string;
  puffs: number;
  flavor: string;
  price: number;
  stock: number;
  image_url: string;
  is_active: boolean;
}

export interface PodModel {
  name: string;
  brand: string;
  puffs: number;
  price: number;
  variants: Product[];
}

export const BRANDS = ["Ignite", "Elf Bar", "Lost Mary"] as const;

const baseModels = [
  { name: "Ignite V50", brand: "Ignite", puffs: 5000, price: 90 },
  { name: "Ignite V80", brand: "Ignite", puffs: 8000, price: 110 },
  { name: "Elf Bar BC5000", brand: "Elf Bar", puffs: 5000, price: 85 },
  { name: "Lost Mary OS5000", brand: "Lost Mary", puffs: 5000, price: 95 },
];

const mockFlavors = [
  "Menthol Ice", "Blueberry Mint", "Strawberry Kiwi", "Watermelon Ice",
  "Mango Peach", "Grape Frost", "Passion Fruit", "Peach Ice",
  "Apple Crisp", "Banana Ice", "Cherry Lemon", "Pineapple Coconut",
  "Kiwi Dragon Berry", "Cool Mint", "Lush Ice", "Blue Razz Ice",
  "Cotton Candy", "Energy Drink", "Gummy Bear", "Rainbow Candy",
  "Sour Apple", "Strawberry Mango", "Triple Berry Ice", "Tropical Blast",
  "Clear Ice"
];

export const products: Product[] = [];

let idCounter = 1;
for (const model of baseModels) {
  for (let i = 0; i < 25; i++) {
    // Para não ter estoques zerados o tempo todo, garantimos que a maioria tenha estoque. 
    // Só uns 10% vão estar zerados pra gente ver como fica a UI de esgotado.
    const isOutOfStock = Math.random() > 0.9; 
    
    products.push({
      id: `p-${idCounter++}`,
      name: model.name,
      brand: model.brand,
      puffs: model.puffs,
      flavor: mockFlavors[i],
      price: model.price,
      stock: isOutOfStock ? 0 : Math.floor(Math.random() * 50) + 1,
      image_url: "",
      is_active: true,
    });
  }
}
