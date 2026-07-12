import {
  Injectable,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /** สร้างผู้ใช้จาก env ตอนสตาร์ทครั้งแรก (ระบบใช้คนเดียว)
   *  ไม่ทับรหัสของผู้ใช้ที่มีอยู่แล้ว — เพื่อให้การเปลี่ยนรหัสในแอปคงอยู่หลัง restart
   *  (ถ้าลืมรหัส: ลบ user ใน DB แล้วสตาร์ทใหม่ ระบบจะสร้างจาก env ให้) */
  async onApplicationBootstrap() {
    const username = this.config.get<string>('ADMIN_USERNAME');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!username || !password) return;
    const existing = await this.users.findOneBy({ username });
    if (existing) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(this.users.create({ username, passwordHash }));
  }

  /** เปลี่ยนรหัสผ่าน — ตรวจรหัสเดิมก่อน */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('รหัสผ่านเดิมไม่ถูกต้อง');
    }
    if (newPassword.length < 6) {
      throw new UnauthorizedException('รหัสใหม่ต้องอย่างน้อย 6 ตัว');
    }
    await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, 10),
    });
    return { ok: true };
  }

  async login(username: string, password: string) {
    const user = await this.users.findOneBy({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.users.findOneByOrFail({ id: payload.sub });
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('refresh token ไม่ถูกต้องหรือหมดอายุ');
    }
  }

  verifyAccess(token: string) {
    return this.jwt.verifyAsync(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, username: user.username };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '1d',
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      }),
    };
  }
}
