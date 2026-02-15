// Test fixture for structure command

class UserService {
  constructor(name: string) {
    this.name = name;
  }

  getUser(_id: number): User | null {
    return null;
  }

  async createUser(_data: UserData): Promise<User> {
    return {} as User;
  }
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

function formatDate(date: Date): string {
  return date.toISOString();
}

interface User {
  id: number;
  name: string;
}

interface UserData {
  name: string;
  email: string;
}

interface CartItem {
  price: number;
}

export { UserService, calculateTotal, formatDate };
